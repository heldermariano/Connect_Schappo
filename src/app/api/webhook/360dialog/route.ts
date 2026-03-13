import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { WebhookPayload360Dialog, getUazapiToken } from '@/lib/types';
import { parse360DialogPayload } from '@/lib/webhook-parser-360';
import { atualizarStatusKonsyst } from '@/lib/db-agenda';
import { sendTextUAZAPI } from '@/lib/whatsapp-provider';

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload360Dialog = await request.json();

    // Debug: logar mensagens recebidas para rastrear tipos nao tratados
    try {
      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          for (const msg of change.value?.messages || []) {
            console.log(`[webhook/360dialog] RECV from=${msg.from} type=${msg.type} id=${msg.id} hasContext=${!!msg.context}`);
          }
        }
      }
    } catch { /* ignore */ }

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
        JSON.stringify(parsed.metadata || {}),
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

    // Auto-atualizar confirmacao de agendamento quando paciente clica botao
    if (parsed.button_reply_id && parsed.context_message_id) {
      const replyId = parsed.button_reply_id.toUpperCase();
      let novoStatus: string | null = null;
      if (replyId === 'CONFIRMAR') novoStatus = 'confirmado';
      else if (replyId === 'DESMARCAR') novoStatus = 'desmarcou';
      else if (replyId === 'REAGENDAR') novoStatus = 'reagendar';

      if (novoStatus) {
        try {
          const btnResult = await pool.query(
            `UPDATE atd.confirmacao_agendamento
             SET status = $1, respondido_at = NOW()
             WHERE wa_message_id = $2 AND status = 'enviado'
             RETURNING id, chave_agenda, telefone_envio`,
            [novoStatus, parsed.context_message_id],
          );
          // Atualizar Konsyst
          for (const row of btnResult.rows) {
            atualizarStatusKonsyst(row.chave_agenda, novoStatus as 'confirmado' | 'desmarcou' | 'reagendar').catch(err =>
              console.error(`[webhook/360dialog] Erro Konsyst chave=${row.chave_agenda}:`, err),
            );
          }

          // Enviar resposta automatica ao paciente via UAZAPI (recepcao)
          if (btnResult.rowCount && btnResult.rowCount > 0 && parsed.telefone) {
            const tokenRecepcao = getUazapiToken('recepcao');
            if (novoStatus === 'confirmado') {
              sendTextUAZAPI(parsed.telefone, 'Agradecemos a sua confirmação! Até breve. 😊\n\nClínica Schappo', tokenRecepcao)
                .catch(err => console.error('[webhook/360dialog] Erro resposta confirmacao:', err));
            } else if (novoStatus === 'desmarcou') {
              sendTextUAZAPI(parsed.telefone, 'Agendamento desmarcado. Estamos à disposição caso precise remarcar.\n\nClínica Schappo', tokenRecepcao)
                .catch(err => console.error('[webhook/360dialog] Erro resposta desmarcacao:', err));
            } else if (novoStatus === 'reagendar') {
              sendTextUAZAPI(parsed.telefone, 'Recebemos sua solicitação de reagendamento. Nossa recepção entrará em contato em breve para agendar uma nova data.\n\nClínica Schappo', tokenRecepcao)
                .catch(err => console.error('[webhook/360dialog] Erro resposta reagendamento:', err));
              // Notificar recepcao
              sseManager.broadcast({
                type: 'nova_notificacao' as 'conversa_atualizada',
                data: {
                  tipo: 'reagendamento',
                  mensagem: `Paciente ${parsed.nome_contato || parsed.telefone} solicitou reagendamento`,
                  telefone: parsed.telefone,
                  conversa_id: conversaId,
                  chaves: btnResult.rows.map(r => r.chave_agenda),
                } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
              });
            }
          }
        } catch (err) {
          console.error('[webhook/360dialog] Erro ao atualizar confirmacao:', err);
        }
      }
    }

    // Auto-atualizar confirmacao por texto (respostas "1...", "2...", "confirmo", etc.)
    if (!parsed.from_me && parsed.telefone && parsed.conteudo) {
      const textoResposta = parsed.conteudo.trim().toLowerCase();
      if (textoResposta.startsWith('1') || textoResposta.startsWith('2') || textoResposta === 'confirmo' || textoResposta === 'confirmar' || textoResposta === 'remarcar' || textoResposta === 'reagendar' || textoResposta === 'desmarcar' || textoResposta === 'cancelar') {
        let novoStatus: string | null = null;
        if (textoResposta.startsWith('1') || textoResposta === 'confirmo' || textoResposta === 'confirmar') novoStatus = 'confirmado';
        else if (textoResposta.startsWith('2') || textoResposta === 'remarcar' || textoResposta === 'reagendar') novoStatus = 'reagendar';
        else if (textoResposta === 'desmarcar' || textoResposta === 'cancelar') novoStatus = 'desmarcou';

        if (novoStatus) {
          try {
            // Comparar com e sem 9o digito (normalize pode diferir entre providers)
            let tel = parsed.telefone.replace(/\D/g, '');
            let telAlt = tel;
            if (tel.length === 13 && tel.startsWith('55')) {
              telAlt = tel.substring(0, 4) + tel.substring(5);
            } else if (tel.length === 12 && tel.startsWith('55')) {
              telAlt = tel.substring(0, 4) + '9' + tel.substring(4);
            }
            const txtResult = await pool.query(
              `UPDATE atd.confirmacao_agendamento
               SET status = $1, respondido_at = NOW()
               WHERE (telefone_envio = $2 OR telefone_envio = $3)
                 AND status = 'enviado'
                 AND enviado_at > NOW() - INTERVAL '7 days'
               RETURNING id, chave_agenda`,
              [novoStatus, tel, telAlt],
            );
            if (txtResult.rowCount && txtResult.rowCount > 0) {
              console.log(`[webhook/360dialog] Confirmacao auto-atualizada: telefone=${parsed.telefone} status=${novoStatus}`);
              // Atualizar Konsyst
              for (const row of txtResult.rows) {
                atualizarStatusKonsyst(row.chave_agenda, novoStatus as 'confirmado' | 'desmarcou' | 'reagendar').catch(err =>
                  console.error(`[webhook/360dialog] Erro Konsyst chave=${row.chave_agenda}:`, err),
                );
              }
              // Broadcast SSE para atualizar pagina de confirmacao
              sseManager.broadcast({
                type: 'confirmacao_atualizada' as 'conversa_atualizada',
                data: {
                  confirmacoes: txtResult.rows.map(r => ({ id: r.id, chave_agenda: r.chave_agenda, status: novoStatus })),
                } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
              });

              // Enviar resposta automatica ao paciente via UAZAPI (recepcao)
              const tokenRecepcao = getUazapiToken('recepcao');
              if (novoStatus === 'confirmado') {
                sendTextUAZAPI(parsed.telefone!, 'Agradecemos a sua confirmação! Até breve. 😊\n\nClínica Schappo', tokenRecepcao)
                  .catch(err => console.error('[webhook/360dialog] Erro resposta confirmacao:', err));
              } else if (novoStatus === 'desmarcou') {
                sendTextUAZAPI(parsed.telefone!, 'Agendamento desmarcado. Estamos à disposição caso precise remarcar.\n\nClínica Schappo', tokenRecepcao)
                  .catch(err => console.error('[webhook/360dialog] Erro resposta desmarcacao:', err));
              } else if (novoStatus === 'reagendar') {
                sendTextUAZAPI(parsed.telefone!, 'Recebemos sua solicitação de reagendamento. Nossa recepção entrará em contato em breve para agendar uma nova data.\n\nClínica Schappo', tokenRecepcao)
                  .catch(err => console.error('[webhook/360dialog] Erro resposta reagendamento:', err));
                sseManager.broadcast({
                  type: 'nova_notificacao' as 'conversa_atualizada',
                  data: {
                    tipo: 'reagendamento',
                    mensagem: `Paciente ${parsed.nome_contato || parsed.telefone} solicitou reagendamento`,
                    telefone: parsed.telefone,
                    conversa_id: conversaId,
                    chaves: txtResult.rows.map(r => r.chave_agenda),
                  } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
                });
              }
            }
          } catch (err) {
            console.error('[webhook/360dialog] Erro ao atualizar confirmacao por texto:', err);
          }
        }
      }
    }

    // 3. Buscar mensagem completa
    const fullMsg = await pool.query(`SELECT * FROM atd.mensagens WHERE id = $1`, [msgId]);

    // 4. Broadcast SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id: conversaId, mensagem: fullMsg.rows[0], categoria: parsed.categoria, tipo: parsed.tipo },
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

  // Processar status updates (delivered, read, sent, failed)
  for (const status of statuses) {
    const result = await pool.query(
      `UPDATE atd.mensagens
       SET status = $1,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{status_history}',
             COALESCE(metadata->'status_history', '[]'::jsonb) || $2::jsonb
           )
       WHERE wa_message_id = $3
       RETURNING id, conversa_id`,
      [
        status.status,
        JSON.stringify({ status: status.status, timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString() }),
        status.wa_message_id,
      ],
    );

    if (result.rowCount && result.rowCount > 0) {
      const { id, conversa_id } = result.rows[0];
      sseManager.broadcast({
        type: 'mensagem_status' as 'conversa_atualizada',
        data: { conversa_id, mensagem_id: id, status: status.status } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
      });
    }
  }
}
