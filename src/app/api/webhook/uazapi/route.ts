import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { WebhookPayloadUAZAPI } from '@/lib/types';
import {
  parseUAZAPIMessage,
  parseUAZAPICall,
  isCallEvent,
  validateWebhookToken,
} from '@/lib/webhook-parser-uazapi';
import { upsertParticipant } from '@/lib/participant-cache';

export async function POST(request: NextRequest) {
  // Responder rapido — processar async
  try {
    const payload: WebhookPayloadUAZAPI = await request.json();

    // Validar token do webhook (UAZAPI envia no body)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && !validateWebhookToken(payload, webhookSecret)) {
      console.warn('[webhook/uazapi] Token invalido recebido');
      // Retornar 200 mesmo assim para nao causar retry
      return NextResponse.json({ status: 'ok' });
    }

    // Processar em background (nao bloquear resposta)
    processUAZAPIWebhook(payload).catch((err) =>
      console.error('[webhook/uazapi] Erro ao processar:', err),
    );

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[webhook/uazapi] Erro ao receber:', err);
    return NextResponse.json({ status: 'ok' });
  }
}

async function processUAZAPIWebhook(payload: WebhookPayloadUAZAPI) {
  // Evento de chamada — registrar tentativa
  if (isCallEvent(payload)) {
    const call = parseUAZAPICall(payload);
    if (!call) return;

    // Upsert conversa para ter referencia
    const conversaResult = await pool.query(
      `SELECT atd.upsert_conversa($1, $2, $3, $4, NULL, NULL, $5) AS id`,
      [call.wa_chatid, 'individual', call.categoria, 'uazapi', call.caller_phone],
    );
    const conversaId = conversaResult.rows[0].id;

    // Registrar chamada como tentativa
    const chamadaResult = await pool.query(
      `INSERT INTO atd.chamadas (conversa_id, wa_chatid, origem, direcao, caller_number, called_number, status)
       VALUES ($1, $2, 'whatsapp-tentativa', 'recebida', $3, $4, 'missed')
       RETURNING *`,
      [conversaId, call.wa_chatid, call.caller_phone, call.owner],
    );

    sseManager.broadcast({
      type: 'chamada_nova',
      data: { chamada: chamadaResult.rows[0] },
    });
    return;
  }

  // Evento de mensagem
  const parsed = parseUAZAPIMessage(payload);
  if (!parsed) return;

  // 1. Upsert conversa
  const conversaResult = await pool.query(
    `SELECT atd.upsert_conversa($1, $2, $3, $4, $5, $6, $7, $8) AS id`,
    [
      parsed.wa_chatid,
      parsed.tipo,
      parsed.categoria,
      parsed.provider,
      parsed.nome_contato,
      parsed.nome_grupo,
      parsed.telefone,
      parsed.avatar_url,
    ],
  );
  const conversaId = conversaResult.rows[0].id;

  // 2. Registrar mensagem (com metadata e mencoes)
  const msgResult = await pool.query(
    `SELECT atd.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS id`,
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
      JSON.stringify(parsed.metadata),
      parsed.mencoes,
    ],
  );
  const msgId = msgResult.rows[0].id;

  // Se mensagem duplicada (id=0), nao emitir SSE
  if (msgId === 0) return;

  // Quando cliente envia mensagem: resetar atribuicao + desarquivar (reaparecer na caixa de entrada)
  if (!parsed.from_me) {
    await pool.query(
      `UPDATE atd.conversas SET atendente_id = NULL, is_archived = FALSE
       WHERE id = $1 AND (atendente_id IS NOT NULL OR is_archived = TRUE)`,
      [conversaId],
    );
  }

  // Cache de participante de grupo (nao bloqueia o fluxo)
  if (parsed.tipo === 'grupo' && parsed.sender_phone && parsed.sender_name) {
    upsertParticipant(parsed.sender_phone, parsed.wa_chatid, parsed.sender_name).catch((err) =>
      console.error('[webhook/uazapi] Erro ao cachear participante:', err),
    );
  }

  // 3. Buscar mensagem completa para o SSE
  const fullMsg = await pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [msgId]);

  // 4. Broadcast via SSE
  sseManager.broadcast({
    type: 'nova_mensagem',
    data: { conversa_id: conversaId, mensagem: fullMsg.rows[0] },
  });

  // 5. Broadcast conversa atualizada
  const convData = await pool.query(
    `SELECT ultima_mensagem, nao_lida, atendente_id FROM atd.conversas WHERE id = $1`,
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
      },
    });
  }
}
