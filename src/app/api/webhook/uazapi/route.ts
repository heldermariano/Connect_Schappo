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
import { atualizarStatusKonsyst } from '@/lib/db-agenda';

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

    // Log de debug para rastrear todos os eventos recebidos
    const chatId = payload.chat?.wa_chatid || '';
    const evtType = payload.EventType || '?';
    const owner = payload.owner || '?';
    const fromMe = payload.message?.fromMe;
    const wasSentByApi = payload.message?.wasSentByApi;
    console.log(`[webhook/uazapi] RECV event=${evtType} owner=${owner} chatid=${chatId} fromMe=${fromMe} wasSentByApi=${wasSentByApi}`);

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
  // Evento de status (delivered, read) — UAZAPI usa EventType 'messages_update'
  // Payload real do UAZAPI messages_update:
  //   { EventType: 'messages_update', state: 'Delivered'|'Read', type: 'ReadReceipt',
  //     event: { Type: 'Delivered'|'Read'|'read', MessageIDs: ['id1','id2'], IsFromMe: bool, Chat: '...@s.whatsapp.net' } }
  // NOTA: NÃO usa payload.message — os dados estão em payload.event
  if (payload.EventType === 'messages_update') {
    const raw = payload as unknown as Record<string, unknown>;
    const event = raw.event as { Type?: string; MessageIDs?: string[]; IsFromMe?: boolean; Chat?: string } | undefined;
    const state = (raw.state as string) || event?.Type || '';
    const messageIds = event?.MessageIDs || [];

    if (!state || messageIds.length === 0) {
      console.log(`[webhook/uazapi] messages_update sem state ou MessageIDs:`, JSON.stringify(raw, null, 2));
      return;
    }

    // Mapear state UAZAPI para nosso formato (case-insensitive)
    const stateMap: Record<string, string> = {
      delivered: 'delivered',
      read: 'read',
      played: 'read',
      sent: 'sent',
      error: 'failed',
    };
    const normalizedStatus = stateMap[state.toLowerCase()] || state.toLowerCase();

    console.log(`[webhook/uazapi] STATUS: ${state} → ${normalizedStatus} | IDs=[${messageIds.join(', ')}] | owner=${payload.owner || '?'}`);

    // Atualizar cada mensagem no array de IDs
    const ownerPrefix = payload.owner ? `${payload.owner}:` : '';
    const timestamp = new Date().toISOString();

    for (const mid of messageIds) {
      const result = await pool.query(
        `UPDATE atd.mensagens
         SET status = $1,
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{status_history}',
               COALESCE(metadata->'status_history', '[]'::jsonb) || $2::jsonb
             )
         WHERE wa_message_id = $3 OR wa_message_id = $4
         RETURNING id, conversa_id`,
        [
          normalizedStatus,
          JSON.stringify({ status: normalizedStatus, timestamp }),
          mid,
          ownerPrefix + mid,
        ],
      );

      if (result.rowCount && result.rowCount > 0) {
        const { id, conversa_id } = result.rows[0];
        sseManager.broadcast({
          type: 'mensagem_status' as 'conversa_atualizada',
          data: { conversa_id, mensagem_id: id, status: normalizedStatus } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
        });
      }
    }
    return;
  }

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

  // Edicao recebida: atualizar mensagem existente ao inves de inserir nova
  if (parsed.edited_message_id) {
    const editedWaId = parsed.edited_message_id;
    const novoConteudo = parsed.conteudo || '';

    const updated = await pool.query(
      `UPDATE atd.mensagens
       SET conteudo = $1, is_edited = true, edited_at = NOW()
       WHERE wa_message_id = $2
       RETURNING id, conversa_id`,
      [novoConteudo, editedWaId],
    );

    if (updated.rowCount === 0) {
      console.log(`[webhook/uazapi] Edicao ignorada: msg original ${editedWaId} nao encontrada`);
      return;
    }

    const { id: editedMsgId, conversa_id: editedConversaId } = updated.rows[0];

    // Atualizar ultima_mensagem da conversa se for a msg mais recente
    await pool.query(
      `UPDATE atd.conversas
       SET ultima_mensagem = LEFT($1, 200), updated_at = NOW()
       WHERE id = $2
         AND ultima_msg_at <= (SELECT created_at FROM atd.mensagens WHERE id = $3)`,
      [novoConteudo, editedConversaId, editedMsgId],
    );

    // Buscar mensagem completa para SSE
    const fullEditedMsg = await pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [editedMsgId]);

    // Broadcast SSE com mesmo formato do PATCH existente
    sseManager.broadcast({
      type: 'mensagem_editada' as 'conversa_atualizada',
      data: { conversa_id: editedConversaId, mensagem: fullEditedMsg.rows[0] } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
    });

    console.log(`[webhook/uazapi] Edicao recebida: msg ${editedWaId} atualizada (id=${editedMsgId})`);
    return;
  }

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

  // Quando cliente envia mensagem: resetar atribuicao + desarquivar + marcar ultima_msg_from_me
  if (!parsed.from_me) {
    await pool.query(
      `UPDATE atd.conversas SET atendente_id = NULL, is_archived = FALSE, ultima_msg_from_me = FALSE
       WHERE id = $1 AND (atendente_id IS NOT NULL OR is_archived = TRUE OR ultima_msg_from_me = TRUE)`,
      [conversaId],
    );

    // Auto-atualizar confirmacao de agendamento quando paciente responde
    // Detectar respostas "1" (confirmar) ou "2" (remarcar) pelo telefone do remetente
    const textoResposta = (parsed.conteudo || '').trim().toLowerCase();
    if (parsed.telefone && (textoResposta.startsWith('1') || textoResposta.startsWith('2') || textoResposta === 'confirmo' || textoResposta === 'confirmar' || textoResposta === 'remarcar' || textoResposta === 'reagendar' || textoResposta === 'desmarcar' || textoResposta === 'cancelar')) {
      try {
        let novoStatus: string | null = null;
        if (textoResposta.startsWith('1') || textoResposta === 'confirmo' || textoResposta === 'confirmar') {
          novoStatus = 'confirmado';
        } else if (textoResposta.startsWith('2') || textoResposta === 'remarcar' || textoResposta === 'reagendar') {
          novoStatus = 'reagendar';
        } else if (textoResposta === 'desmarcar' || textoResposta === 'cancelar') {
          novoStatus = 'desmarcou';
        }

        if (novoStatus) {
          // Buscar confirmacao pendente (enviado) para este telefone nos ultimos 7 dias
          // Comparar com e sem 9o digito (UAZAPI pode normalizar diferente)
          let tel = parsed.telefone.replace(/\D/g, '');
          let telAlt = tel;
          if (tel.length === 13 && tel.startsWith('55')) {
            // Com 9o digito: 55 + DD + 9XXXX → remover o 9
            telAlt = tel.substring(0, 4) + tel.substring(5);
          } else if (tel.length === 12 && tel.startsWith('55')) {
            // Sem 9o digito: 55 + DD + XXXX → adicionar 9
            telAlt = tel.substring(0, 4) + '9' + tel.substring(4);
          }
          const confirmResult = await pool.query(
            `UPDATE atd.confirmacao_agendamento
             SET status = $1, respondido_at = NOW()
             WHERE (telefone_envio = $2 OR telefone_envio = $3)
               AND status = 'enviado'
               AND enviado_at > NOW() - INTERVAL '7 days'
             RETURNING id, chave_agenda`,
            [novoStatus, tel, telAlt],
          );

          if (confirmResult.rowCount && confirmResult.rowCount > 0) {
            console.log(`[webhook/uazapi] Confirmacao auto-atualizada: telefone=${parsed.telefone} status=${novoStatus} chaves=${confirmResult.rows.map(r => r.chave_agenda).join(',')}`);

            // Atualizar status no Konsyst (banco ERP externo)
            for (const row of confirmResult.rows) {
              atualizarStatusKonsyst(row.chave_agenda, novoStatus as 'confirmado' | 'desmarcou' | 'reagendar').catch(err =>
                console.error(`[webhook/uazapi] Erro Konsyst chave=${row.chave_agenda}:`, err),
              );
            }

            // Broadcast SSE para atualizar pagina de confirmacao
            sseManager.broadcast({
              type: 'confirmacao_atualizada' as 'conversa_atualizada',
              data: {
                confirmacoes: confirmResult.rows.map(r => ({ id: r.id, chave_agenda: r.chave_agenda, status: novoStatus })),
              } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
            });
          }
        }
      } catch (err) {
        console.error('[webhook/uazapi] Erro ao atualizar confirmacao:', err);
      }
    }
  }

  // Cache de participante de grupo (nao bloqueia o fluxo)
  if (parsed.tipo === 'grupo' && parsed.sender_phone && parsed.sender_name) {
    const senderLid = parsed.metadata?.sender_lid as string | undefined;
    upsertParticipant(parsed.sender_phone, parsed.wa_chatid, parsed.sender_name, null, senderLid).catch((err) =>
      console.error('[webhook/uazapi] Erro ao cachear participante:', err),
    );
  }

  // 3. Buscar mensagem completa para o SSE
  const fullMsg = await pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [msgId]);

  // 4. Broadcast via SSE
  sseManager.broadcast({
    type: 'nova_mensagem',
    data: { conversa_id: conversaId, mensagem: fullMsg.rows[0], categoria: parsed.categoria, tipo: parsed.tipo },
  });

  // 5. Broadcast conversa atualizada
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
