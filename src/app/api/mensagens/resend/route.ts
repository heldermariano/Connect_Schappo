import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { getUazapiToken } from '@/lib/types';
import { requireAuth, isAuthed, apiError } from '@/lib/api-auth';
import { sendTextUAZAPI, sendText360Dialog } from '@/lib/whatsapp-provider';
import { updateConversaAfterSend, broadcastNewMessage, formatRecipient, generateMessageId, saveOutgoingMessage } from '@/lib/conversa-update';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { mensagem_id } = await request.json();

    if (!mensagem_id) {
      return NextResponse.json({ error: 'mensagem_id e obrigatorio' }, { status: 400 });
    }

    // Buscar mensagem original com dados da conversa
    const msgResult = await pool.query(
      `SELECT m.*, c.wa_chatid, c.tipo, c.categoria, c.provider, c.telefone
       FROM atd.mensagens m
       JOIN atd.conversas c ON c.id = m.conversa_id
       WHERE m.id = $1`,
      [mensagem_id],
    );

    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    const original = msgResult.rows[0];

    // Apenas mensagens proprias podem ser reenviadas
    if (!original.from_me) {
      return NextResponse.json({ error: 'Somente mensagens proprias podem ser reenviadas' }, { status: 403 });
    }

    // Verificar permissao do grupo
    if (!auth.categoriasPermitidas.includes(original.categoria)) {
      return apiError('Sem permissao para esta conversa', 403);
    }

    // Determinar destinatario
    const destinatario = formatRecipient(original.wa_chatid, original.tipo, original.provider);

    // Montar texto para reenvio
    const conteudoOriginal = original.conteudo || `[${original.tipo_mensagem}]`;
    const nomeOperador = auth.session.user.nome;
    const textToSend = `*${nomeOperador}:*\n${conteudoOriginal}`;

    // Enviar via provider correto
    let sendResult;

    if (original.provider === '360dialog') {
      sendResult = await sendText360Dialog(destinatario, textToSend);
    } else {
      const uazapiToken = getUazapiToken(original.categoria);
      sendResult = await sendTextUAZAPI(destinatario, textToSend, uazapiToken);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao reenviar' }, { status: 502 });
    }

    const waMessageId = sendResult.messageId || generateMessageId('resend');

    let mensagem;

    if (original.status === 'failed') {
      // Mensagem original falhou — atualizar in-place (evita duplicata no chat)
      const updResult = await pool.query(
        `UPDATE atd.mensagens SET
          wa_message_id = $1,
          status = 'sent',
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          created_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [
          waMessageId,
          JSON.stringify({
            resent_at: new Date().toISOString(),
            resent_by: auth.session.user.nome,
            message_id_full: sendResult.fullMessageId || waMessageId,
            send_error: null,
          }),
          mensagem_id,
        ],
      );
      mensagem = updResult.rows[0];

      // Emitir SSE de status atualizado (remove o icone de falha)
      sseManager.broadcast({
        type: 'mensagem_status' as 'conversa_atualizada',
        data: { conversa_id: original.conversa_id, mensagem_id: mensagem.id, status: 'sent' } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
      });
    } else {
      // Mensagem original ja foi enviada — criar nova (reenvio manual)
      mensagem = await saveOutgoingMessage(pool, {
        conversa_id: original.conversa_id,
        wa_message_id: waMessageId,
        tipo_mensagem: 'text',
        conteudo: conteudoOriginal,
        sender_name: auth.session.user.nome,
        categoria: original.categoria,
        status: 'sent',
        metadata: {
          sent_by: auth.session.user.id,
          sent_by_name: auth.session.user.nome,
          resent_from: mensagem_id,
          message_id_full: sendResult.fullMessageId || waMessageId,
        },
      });

      if (!mensagem) {
        return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
      }

      // Marcar original com info de reenvio
      await pool.query(
        `UPDATE atd.mensagens SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ resent_at: new Date().toISOString(), resent_by: auth.session.user.nome }), mensagem_id],
      );

      // Emitir SSE nova mensagem
      broadcastNewMessage(original.conversa_id, mensagem, original.categoria, original.tipo);
    }

    // Atualizar conversa + broadcast SSE conversa_atualizada
    await updateConversaAfterSend(pool, original.conversa_id, conteudoOriginal);

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/resend] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
