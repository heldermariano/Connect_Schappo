import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUazapiToken } from '@/lib/types';
import { requireAuth, isAuthed, apiError } from '@/lib/api-auth';
import { sendContactUAZAPI, sendContact360Dialog } from '@/lib/whatsapp-provider';
import { saveOutgoingMessage, updateConversaAfterSend, broadcastNewMessage, formatRecipient, generateMessageId, buildSendMetadata } from '@/lib/conversa-update';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const { conversa_id, contact_name, contact_phone } = await request.json();

    if (!conversa_id || !contact_name || !contact_phone) {
      return NextResponse.json({ error: 'conversa_id, contact_name e contact_phone sao obrigatorios' }, { status: 400 });
    }

    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone FROM atd.conversas WHERE id = $1`,
      [conversa_id],
    );
    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = conversaResult.rows[0];

    if (!auth.categoriasPermitidas.includes(conversa.categoria)) {
      return apiError('Sem permissao', 403);
    }

    const dest = formatRecipient(conversa.wa_chatid, conversa.tipo, conversa.provider);

    let sendResult;
    if (conversa.provider === '360dialog') {
      sendResult = await sendContact360Dialog(dest, contact_name, contact_phone);
    } else {
      const uazapiToken = getUazapiToken(conversa.categoria);
      sendResult = await sendContactUAZAPI(dest, contact_name, contact_phone, uazapiToken);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao enviar' }, { status: 502 });
    }

    const waMessageId = sendResult.messageId || generateMessageId('sent_contact');
    const conteudoTexto = `👤 ${contact_name}\n${contact_phone}`;
    const metadata = buildSendMetadata(auth.session.user.id, auth.session.user.nome, sendResult, { contact_name, contact_phone });

    const mensagem = await saveOutgoingMessage(pool, {
      conversa_id,
      wa_message_id: waMessageId,
      tipo_mensagem: 'contacts',
      conteudo: conteudoTexto,
      sender_name: auth.session.user.nome,
      categoria: conversa.categoria,
      metadata,
    });

    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    await updateConversaAfterSend(pool, conversa_id, conteudoTexto);
    broadcastNewMessage(conversa_id, mensagem, conversa.categoria);

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/send-contact] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
