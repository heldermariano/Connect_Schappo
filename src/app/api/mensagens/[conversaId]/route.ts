import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Resolve mencoes (telefones ou LIDs) para nomes via atd.participantes_grupo.
 * Busca tanto por wa_phone quanto por wa_lid, pois o WhatsApp pode usar
 * Linked IDs (LIDs) em vez de telefones reais nas mencoes.
 * Retorna mapa { identificador: nome } para cada id mencionado.
 */
async function resolveMencoes(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (match_id) match_id, nome FROM (
         SELECT wa_phone as match_id, COALESCE(nome_salvo, nome_whatsapp) as nome
         FROM atd.participantes_grupo
         WHERE wa_phone = ANY($1) AND COALESCE(nome_salvo, nome_whatsapp) IS NOT NULL
         UNION ALL
         SELECT wa_lid as match_id, COALESCE(nome_salvo, nome_whatsapp) as nome
         FROM atd.participantes_grupo
         WHERE wa_lid = ANY($1) AND wa_lid IS NOT NULL AND COALESCE(nome_salvo, nome_whatsapp) IS NOT NULL
       ) sub
       ORDER BY match_id, nome`,
      [ids],
    );

    const map: Record<string, string> = {};
    for (const row of result.rows) {
      if (row.nome) {
        map[row.match_id] = row.nome;
      }
    }
    return map;
  } catch {
    // Tabela pode nao existir ainda — retornar vazio
    return {};
  }
}

/**
 * Extrai numeros de telefone encontrados no texto apos @.
 * Ex: "@253419897049 @93858004254863" → ["253419897049", "93858004254863"]
 */
function extractPhonesFromText(text: string | null): string[] {
  if (!text) return [];
  const regex = /@(\d{8,15})/g;
  const phones: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    phones.push(match[1]);
  }
  return phones;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversaId: string }> },
) {
  const { conversaId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const before = searchParams.get('before'); // ID para paginacao cursor

  const id = parseInt(conversaId);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    let query: string;
    let values: unknown[];

    if (before) {
      query = `
        SELECT * FROM atd.mensagens
        WHERE conversa_id = $1 AND id < $2
        ORDER BY created_at DESC
        LIMIT $3
      `;
      values = [id, parseInt(before), limit];
    } else {
      query = `
        SELECT * FROM atd.mensagens
        WHERE conversa_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      values = [id, limit];
    }

    const result = await pool.query(query, values);

    // Retornar em ordem cronologica (mais antiga primeiro)
    const mensagens = result.rows.reverse();
    const hasMore = result.rows.length === limit;

    // Coletar todos os telefones mencionados para resolver nomes em lote
    // Inclui tanto o array mencoes[] quanto @numero encontrados no texto
    const allMencoes = new Set<string>();
    for (const msg of mensagens) {
      if (Array.isArray(msg.mencoes)) {
        for (const phone of msg.mencoes) {
          allMencoes.add(phone);
        }
      }
      // Extrair @numero do conteudo do texto
      const textPhones = extractPhonesFromText(msg.conteudo);
      for (const phone of textPhones) {
        allMencoes.add(phone);
      }
    }

    // Resolver nomes das mencoes
    const mencoesResolvidas = await resolveMencoes([...allMencoes]);

    // Coletar sender_phones unicos (nao from_me) para buscar avatares
    const senderPhones = new Set<string>();
    for (const msg of mensagens) {
      if (!msg.from_me && msg.sender_phone) {
        senderPhones.add(msg.sender_phone);
      }
    }

    // Batch-query avatares dos participantes
    let avatarMap: Record<string, string> = {};
    if (senderPhones.size > 0) {
      try {
        const avatarResult = await pool.query(
          `SELECT DISTINCT ON (wa_phone) wa_phone, avatar_url
           FROM atd.participantes_grupo
           WHERE wa_phone = ANY($1) AND avatar_url IS NOT NULL AND avatar_url != ''
           ORDER BY wa_phone, atualizado_at DESC`,
          [[...senderPhones]],
        );
        for (const row of avatarResult.rows) {
          avatarMap[row.wa_phone] = row.avatar_url;
        }
      } catch {
        // Tabela pode nao existir — ignorar
      }
    }

    // Batch-query mensagens citadas (quoted)
    const quotedIds = new Set<string>();
    for (const msg of mensagens) {
      if (msg.quoted_msg_id) quotedIds.add(msg.quoted_msg_id);
    }
    let quotedMap: Record<string, Record<string, unknown>> = {};
    if (quotedIds.size > 0) {
      try {
        const quotedResult = await pool.query(
          `SELECT id, wa_message_id, sender_name, sender_phone, from_me, tipo_mensagem, LEFT(conteudo, 150) as conteudo, media_filename
           FROM atd.mensagens
           WHERE wa_message_id = ANY($1)`,
          [[...quotedIds]],
        );
        for (const row of quotedResult.rows) {
          quotedMap[row.wa_message_id] = row;
        }
      } catch {
        // Coluna pode nao existir — ignorar
      }
    }

    // Adicionar mencoes_resolvidas e sender_avatar_url a cada mensagem
    const mensagensEnriquecidas = mensagens.map((msg) => {
      const enriched = { ...msg } as Record<string, unknown>;

      // Coletar telefones do array mencoes + @numero no texto
      const phoneSet = new Set<string>();
      if (Array.isArray(msg.mencoes)) {
        for (const phone of msg.mencoes) phoneSet.add(phone);
      }
      for (const phone of extractPhonesFromText(msg.conteudo)) {
        phoneSet.add(phone);
      }

      // Resolver mencoes: funciona tanto para mencoes do array quanto @numero no texto
      if (phoneSet.size > 0) {
        const resolved: Record<string, string> = {};
        for (const phone of phoneSet) {
          if (mencoesResolvidas[phone]) {
            resolved[phone] = mencoesResolvidas[phone];
          }
        }
        if (Object.keys(resolved).length > 0) {
          enriched.mencoes_resolvidas = resolved;
        }
      }

      // Avatar do sender
      if (!msg.from_me && msg.sender_phone && avatarMap[msg.sender_phone]) {
        enriched.sender_avatar_url = avatarMap[msg.sender_phone];
      }

      // Mensagem citada (quoted)
      if (msg.quoted_msg_id && quotedMap[msg.quoted_msg_id]) {
        enriched.quoted_message = quotedMap[msg.quoted_msg_id];
      }

      return enriched;
    });

    return NextResponse.json({ mensagens: mensagensEnriquecidas, hasMore });
  } catch (err) {
    console.error('[api/mensagens] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
