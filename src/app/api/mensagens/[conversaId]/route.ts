import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Resolve mencoes (telefones) para nomes via atd.participantes_grupo.
 * Retorna mapa { telefone: nome } para cada telefone mencionado.
 */
async function resolveMencoes(phones: string[]): Promise<Record<string, string>> {
  if (phones.length === 0) return {};

  try {
    const result = await pool.query(
      `SELECT wa_phone, COALESCE(nome_salvo, nome_whatsapp) as nome
       FROM atd.participantes_grupo
       WHERE wa_phone = ANY($1) AND COALESCE(nome_salvo, nome_whatsapp) IS NOT NULL`,
      [phones],
    );

    const map: Record<string, string> = {};
    for (const row of result.rows) {
      if (row.nome) {
        map[row.wa_phone] = row.nome;
      }
    }
    return map;
  } catch {
    // Tabela pode nao existir ainda — retornar vazio
    return {};
  }
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
    const allMencoes = new Set<string>();
    for (const msg of mensagens) {
      if (Array.isArray(msg.mencoes)) {
        for (const phone of msg.mencoes) {
          allMencoes.add(phone);
        }
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

    // Adicionar mencoes_resolvidas e sender_avatar_url a cada mensagem
    const mensagensEnriquecidas = mensagens.map((msg) => {
      const enriched = { ...msg } as Record<string, unknown>;

      // Mencoes resolvidas
      if (Array.isArray(msg.mencoes) && msg.mencoes.length > 0) {
        const resolved: Record<string, string> = {};
        for (const phone of msg.mencoes) {
          if (mencoesResolvidas[phone]) {
            resolved[phone] = mencoesResolvidas[phone];
          }
        }
        enriched.mencoes_resolvidas = resolved;
      }

      // Avatar do sender
      if (!msg.from_me && msg.sender_phone && avatarMap[msg.sender_phone]) {
        enriched.sender_avatar_url = avatarMap[msg.sender_phone];
      }

      return enriched;
    });

    return NextResponse.json({ mensagens: mensagensEnriquecidas, hasMore });
  } catch (err) {
    console.error('[api/mensagens] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
