import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import chatwootPool from '@/lib/db-chatwoot';

// Mapeamento Chatwoot inbox → Connect Schappo
const INBOX_MAP: Record<number, { categoria: string; provider: string }> = {
  4: { categoria: 'recepcao', provider: 'uazapi' },
  5: { categoria: 'eeg', provider: 'uazapi' },
  8: { categoria: 'geral', provider: '360dialog' },
  10: { categoria: 'recepcao', provider: 'uazapi' },
  11: { categoria: 'eeg', provider: 'uazapi' },
};

// Chatwoot file_type → Connect tipo_mensagem
const FILE_TYPE_MAP: Record<number, string> = {
  0: 'image',
  1: 'video',
  2: 'document',
  3: 'audio',
  4: 'location',
  5: 'contact',
};

// Limpar prefixo **Nome:** das mensagens do Chatwoot
function extractSenderAndContent(content: string | null): { sender: string | null; text: string } {
  if (!content) return { sender: null, text: '' };
  const match = content.match(/^\*\*([^*]*):\*\*\s*/);
  if (match) {
    const sender = match[1]?.trim() || null;
    return { sender, text: content.slice(match[0].length) };
  }
  return { sender: null, text: content };
}

// Limpar telefone: remover + e espacos
function cleanPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

interface CwConversation {
  conv_id: number;
  inbox_id: number;
  contact_name: string;
  phone_number: string | null;
  identifier: string | null;
  conv_status: number;
  is_group: boolean;
}

interface CwMessage {
  id: number;
  content: string | null;
  message_type: number; // 0=incoming, 1=outgoing
  source_id: string | null;
  content_type: number;
  sender_type: string | null;
  created_at: Date;
  has_attachment: boolean;
  file_type: number | null;
  fallback_title: string | null;
}

// GET: preview da migracao
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
  }

  try {
    // Contagens do Chatwoot
    const cwStats = await chatwootPool.query(`
      SELECT
        cv.inbox_id,
        i.name AS inbox_name,
        COUNT(DISTINCT cv.id) AS conversas,
        COUNT(DISTINCT cv.contact_id) AS contatos,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = ANY(array_agg(cv.id)) AND m.message_type IN (0, 1) AND m.private = false) AS mensagens
      FROM conversations cv
      JOIN inboxes i ON i.id = cv.inbox_id
      WHERE cv.inbox_id IN (4, 5, 8, 10, 11)
      GROUP BY cv.inbox_id, i.name
      ORDER BY cv.inbox_id
    `);

    // Contagens do Connect
    const connectStats = await pool.query(`
      SELECT
        categoria,
        COUNT(*) AS conversas,
        (SELECT COUNT(*) FROM atd.mensagens m WHERE m.conversa_id = ANY(array_agg(c.id))) AS mensagens
      FROM atd.conversas c
      GROUP BY categoria
      ORDER BY categoria
    `);

    // Mensagens ja importadas do Chatwoot
    const imported = await pool.query(`
      SELECT COUNT(*) FROM atd.mensagens WHERE wa_message_id LIKE 'cw_%'
    `);

    return NextResponse.json({
      chatwoot: cwStats.rows,
      connect: connectStats.rows,
      ja_importadas: parseInt(imported.rows[0].count),
    });
  } catch (err) {
    console.error('[migration/chatwoot] Erro preview:', err);
    return NextResponse.json({ error: 'Erro ao consultar bancos' }, { status: 500 });
  }
}

// POST: executar migracao
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dry_run === true;
  const inboxFilter: number[] = body.inboxes || [4, 5, 8, 10, 11];

  const stats = {
    conversas_processadas: 0,
    conversas_criadas: 0,
    conversas_existentes: 0,
    mensagens_importadas: 0,
    mensagens_duplicadas: 0,
    erros: 0,
    detalhes: [] as string[],
  };

  try {
    // 1. Buscar todas as conversas do Chatwoot com dados do contato
    const cwConversas = await chatwootPool.query<CwConversation>(`
      SELECT
        cv.id AS conv_id,
        cv.inbox_id,
        COALESCE(ct.name, '') AS contact_name,
        ct.phone_number,
        ct.identifier,
        cv.status AS conv_status,
        (cv.inbox_id IN (10, 11)) AS is_group
      FROM conversations cv
      JOIN contacts ct ON ct.id = cv.contact_id
      WHERE cv.inbox_id = ANY($1::int[])
      ORDER BY cv.inbox_id, cv.created_at
    `, [inboxFilter]);

    console.log(`[migration] ${cwConversas.rows.length} conversas no Chatwoot para processar`);

    // 2. Agrupar conversas por wa_chatid + categoria (merge multiplas conversas do mesmo contato)
    const grouped = new Map<string, { wa_chatid: string; categoria: string; provider: string; tipo: string; telefone: string; nome_contato: string; conv_ids: number[] }>();

    for (const cv of cwConversas.rows) {
      const mapping = INBOX_MAP[cv.inbox_id];
      if (!mapping) continue;

      let wa_chatid: string;
      let telefone: string;
      let tipo: string;

      if (cv.is_group) {
        // Grupo: usar identifier como wa_chatid
        const groupId = cv.identifier;
        if (!groupId || !groupId.includes('@g.us')) {
          // Contato individual em inbox de grupo (tem phone_number) — tratar como individual
          if (cv.phone_number) {
            telefone = cleanPhone(cv.phone_number);
            wa_chatid = `${telefone}@s.whatsapp.net`;
            tipo = 'individual';
          } else {
            continue; // Sem identifier de grupo e sem telefone — pular
          }
        } else {
          wa_chatid = groupId;
          telefone = '';
          tipo = 'grupo';
        }
      } else {
        // Individual: usar phone_number
        if (!cv.phone_number) continue;
        telefone = cleanPhone(cv.phone_number);
        if (!telefone) continue;
        wa_chatid = `${telefone}@s.whatsapp.net`;
        tipo = 'individual';
      }

      const key = `${wa_chatid}|${mapping.categoria}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.conv_ids.push(cv.conv_id);
        // Usar nome mais recente se disponivel
        if (cv.contact_name && !existing.nome_contato) {
          existing.nome_contato = cv.contact_name;
        }
      } else {
        grouped.set(key, {
          wa_chatid,
          categoria: mapping.categoria,
          provider: mapping.provider,
          tipo,
          telefone,
          nome_contato: cv.contact_name || '',
          conv_ids: [cv.conv_id],
        });
      }
    }

    console.log(`[migration] ${grouped.size} conversas unicas apos agrupamento`);

    // 3. Processar cada conversa agrupada
    for (const [key, conv] of grouped) {
      try {
        stats.conversas_processadas++;

        // Upsert conversa no Connect
        let conversaId: number;

        if (dryRun) {
          // Apenas simular
          const existing = await pool.query(
            `SELECT id FROM atd.conversas WHERE wa_chatid = $1 AND categoria = $2`,
            [conv.wa_chatid, conv.categoria],
          );
          if (existing.rows.length > 0) {
            conversaId = existing.rows[0].id;
            stats.conversas_existentes++;
          } else {
            stats.conversas_criadas++;
            continue; // Em dry_run, nao criar conversa
          }
        } else {
          // Tentar inserir, se ja existe pegar o id existente
          const upsertResult = await pool.query(
            `INSERT INTO atd.conversas (wa_chatid, tipo, categoria, provider, telefone, nome_contato, is_archived, nao_lida, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, 0, NOW())
             ON CONFLICT (wa_chatid, categoria) DO NOTHING
             RETURNING id`,
            [conv.wa_chatid, conv.tipo, conv.categoria, conv.provider, conv.telefone, conv.nome_contato],
          );

          if (upsertResult.rows.length > 0) {
            conversaId = upsertResult.rows[0].id;
            stats.conversas_criadas++;
          } else {
            // Ja existe — buscar id
            const existing = await pool.query(
              `SELECT id FROM atd.conversas WHERE wa_chatid = $1 AND categoria = $2`,
              [conv.wa_chatid, conv.categoria],
            );
            conversaId = existing.rows[0].id;
            stats.conversas_existentes++;
          }
        }

        if (dryRun) continue;

        // Buscar mensagens do Chatwoot para todas as conversas deste contato
        const cwMsgs = await chatwootPool.query<CwMessage>(`
          SELECT
            m.id,
            m.content,
            m.message_type,
            m.source_id,
            m.content_type,
            m.sender_type,
            m.created_at,
            (EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id)) AS has_attachment,
            (SELECT a.file_type FROM attachments a WHERE a.message_id = m.id LIMIT 1) AS file_type,
            (SELECT a.fallback_title FROM attachments a WHERE a.message_id = m.id LIMIT 1) AS fallback_title
          FROM messages m
          WHERE m.conversation_id = ANY($1::int[])
            AND m.message_type IN (0, 1)
            AND m.private = false
          ORDER BY m.created_at ASC
        `, [conv.conv_ids]);

        if (cwMsgs.rows.length === 0) continue;

        // Inserir mensagens em batch
        for (const msg of cwMsgs.rows) {
          try {
            // Determinar wa_message_id unico
            const waMessageId = msg.source_id || `cw_${msg.id}`;

            // Extrair sender e limpar conteudo
            const { sender, text } = extractSenderAndContent(msg.content);

            // Determinar tipo de mensagem
            let tipoMensagem = 'text';
            if (msg.has_attachment && msg.file_type !== null) {
              tipoMensagem = FILE_TYPE_MAP[msg.file_type] || 'document';
            }

            // Conteudo: texto limpo, ou indicador de midia se nao tem texto
            let conteudo = text;
            if (!conteudo && msg.has_attachment) {
              const tipoLabel = tipoMensagem === 'image' ? 'Imagem' :
                tipoMensagem === 'video' ? 'Video' :
                tipoMensagem === 'audio' ? 'Audio' :
                tipoMensagem === 'document' ? (msg.fallback_title || 'Documento') :
                'Midia';
              conteudo = `[${tipoLabel}]`;
            }

            const fromMe = msg.message_type === 1;
            const senderName = sender || (fromMe ? null : conv.nome_contato || null);

            const insertResult = await pool.query(
              `INSERT INTO atd.mensagens (conversa_id, wa_message_id, from_me, tipo_mensagem, conteudo, sender_name, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (wa_message_id) DO NOTHING
               RETURNING id`,
              [
                conversaId,
                waMessageId,
                fromMe,
                tipoMensagem,
                conteudo || '',
                senderName,
                JSON.stringify({ source: 'chatwoot', chatwoot_id: msg.id }),
                msg.created_at,
              ],
            );

            if (insertResult.rows.length > 0) {
              stats.mensagens_importadas++;
            } else {
              stats.mensagens_duplicadas++;
            }
          } catch (msgErr) {
            stats.erros++;
            if (stats.erros <= 10) {
              stats.detalhes.push(`Erro msg cw_${msg.id}: ${(msgErr as Error).message}`);
            }
          }
        }

        // Atualizar ultima_mensagem e ultima_msg_at da conversa com base na msg mais recente
        await pool.query(
          `UPDATE atd.conversas SET
            ultima_mensagem = (SELECT conteudo FROM atd.mensagens WHERE conversa_id = $1 ORDER BY created_at DESC LIMIT 1),
            ultima_msg_at = (SELECT created_at FROM atd.mensagens WHERE conversa_id = $1 ORDER BY created_at DESC LIMIT 1),
            nome_contato = CASE WHEN nome_contato IS NULL OR nome_contato = '' THEN $2 ELSE nome_contato END
          WHERE id = $1`,
          [conversaId, conv.nome_contato],
        );

        // Log progresso a cada 100 conversas
        if (stats.conversas_processadas % 100 === 0) {
          console.log(`[migration] Progresso: ${stats.conversas_processadas} conversas, ${stats.mensagens_importadas} msgs importadas`);
        }
      } catch (convErr) {
        stats.erros++;
        if (stats.erros <= 10) {
          stats.detalhes.push(`Erro conversa ${key}: ${(convErr as Error).message}`);
        }
      }
    }

    // Atualizar nome_grupo para conversas de grupo importadas
    if (!dryRun) {
      await pool.query(`
        UPDATE atd.conversas c SET nome_grupo = sub.nome
        FROM (
          SELECT cv.wa_chatid, cv.categoria, cv.nome_contato AS nome
          FROM atd.conversas cv
          WHERE cv.tipo = 'grupo' AND cv.nome_grupo IS NULL AND cv.nome_contato IS NOT NULL AND cv.nome_contato != ''
            AND EXISTS (SELECT 1 FROM atd.mensagens m WHERE m.conversa_id = cv.id AND m.metadata->>'source' = 'chatwoot')
        ) sub
        WHERE c.wa_chatid = sub.wa_chatid AND c.categoria = sub.categoria
      `);
    }

    console.log(`[migration] Concluido! ${JSON.stringify(stats)}`);

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      ...stats,
    });
  } catch (err) {
    console.error('[migration/chatwoot] Erro:', err);
    return NextResponse.json({
      error: 'Erro na migracao',
      message: (err as Error).message,
      ...stats,
    }, { status: 500 });
  }
}
