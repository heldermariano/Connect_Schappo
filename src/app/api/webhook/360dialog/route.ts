import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { WebhookPayload360Dialog } from '@/lib/types';
import { parse360DialogPayload } from '@/lib/webhook-parser-360';

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload360Dialog = await request.json();

    // Processar em background
    process360Webhook(payload).catch((err) =>
      console.error('[webhook/360dialog] Erro ao processar:', err),
    );

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[webhook/360dialog] Erro ao receber:', err);
    return NextResponse.json({ status: 'ok' });
  }
}

// Verificacao de webhook do Meta (GET para validacao)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WEBHOOK_SECRET) {
    return new Response(challenge || '', { status: 200 });
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

async function process360Webhook(payload: WebhookPayload360Dialog) {
  const { messages, statuses } = parse360DialogPayload(payload);

  // Processar mensagens
  for (const parsed of messages) {
    // 1. Upsert conversa
    const conversaResult = await pool.query(
      `SELECT atd.upsert_conversa($1, $2, $3, $4, $5, NULL, $6) AS id`,
      [
        parsed.wa_chatid,
        parsed.tipo,
        parsed.categoria,
        parsed.provider,
        parsed.nome_contato,
        parsed.telefone,
      ],
    );
    const conversaId = conversaResult.rows[0].id;

    // 2. Registrar mensagem
    const msgResult = await pool.query(
      `SELECT atd.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) AS id`,
      [
        conversaId,
        parsed.wa_message_id,
        parsed.from_me,
        parsed.sender_phone,
        parsed.sender_name,
        parsed.tipo_mensagem,
        parsed.conteudo,
        parsed.media_url,
        parsed.media_mimetype,
        parsed.media_filename,
        JSON.stringify({}),
      ],
    );
    const msgId = msgResult.rows[0].id;

    if (msgId === 0) continue; // Duplicada

    // Quando cliente envia mensagem: resetar atribuicao + desarquivar + marcar ultima_msg_from_me
    if (!parsed.from_me) {
      await pool.query(
        `UPDATE atd.conversas SET atendente_id = NULL, is_archived = FALSE, ultima_msg_from_me = FALSE
         WHERE id = $1 AND (atendente_id IS NOT NULL OR is_archived = TRUE OR ultima_msg_from_me = TRUE)`,
        [conversaId],
      );
    }

    // 3. Buscar mensagem completa
    const fullMsg = await pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [msgId]);

    // 4. Broadcast SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id: conversaId, mensagem: fullMsg.rows[0], categoria: parsed.categoria },
    });

    const convData = await pool.query(
      `SELECT ultima_mensagem, nao_lida, atendente_id, ultima_msg_from_me FROM atd.conversas WHERE id = $1`,
      [conversaId],
    );
    if (convData.rows[0]) {
      sseManager.broadcast({
        type: 'conversa_atualizada',
        data: {
          conversa_id: conversaId,
          ultima_msg: convData.rows[0].ultima_mensagem || '',
          nao_lida: convData.rows[0].nao_lida,
          atendente_id: convData.rows[0].atendente_id,
          ultima_msg_from_me: convData.rows[0].ultima_msg_from_me,
        },
      });
    }
  }

  // Processar status updates
  for (const status of statuses) {
    await pool.query(
      `UPDATE atd.mensagens SET status = $1 WHERE wa_message_id = $2`,
      [status.status, status.wa_message_id],
    );
  }
}
