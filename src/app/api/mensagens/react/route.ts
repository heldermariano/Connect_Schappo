import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { CATEGORIA_OWNER, getUazapiToken, normalizePhone } from '@/lib/types';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { conversa_id, wa_message_id, emoji } = await request.json();

    if (!conversa_id || !wa_message_id || !emoji) {
      return NextResponse.json({ error: 'conversa_id, wa_message_id e emoji sao obrigatorios' }, { status: 400 });
    }

    // Buscar conversa
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone
       FROM atd.conversas WHERE id = $1`,
      [conversa_id],
    );

    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = conversaResult.rows[0];
    const isGroup = conversa.tipo === 'grupo';
    const destinatario = isGroup
      ? conversa.wa_chatid
      : conversa.wa_chatid.replace('@s.whatsapp.net', '');

    // Enviar reacao via provider
    // UAZAPI: POST /message/react { number, text (emoji), id (wa_message_id) }
    if (conversa.provider === 'uazapi') {
      const url = process.env.UAZAPI_URL;
      const token = getUazapiToken(conversa.categoria);
      if (url && token) {
        await fetch(`${url}/message/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token },
          body: JSON.stringify({
            number: destinatario,
            text: emoji,
            id: wa_message_id,
          }),
        });
      }
    } else if (conversa.provider === '360dialog') {
      const apiUrl = process.env.DIALOG360_API_URL;
      const apiKey = process.env.DIALOG360_API_KEY;
      if (apiUrl && apiKey) {
        const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
        await fetch(`${apiUrl}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'reaction',
            reaction: { message_id: wa_message_id, emoji },
          }),
        });
      }
    }

    // Salvar reacao no banco
    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const reactionMsgId = `reaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, status, metadata
      ) VALUES ($1, $2, true, $3, $4, 'reaction', $5, 'sent', $6)
      ON CONFLICT (wa_message_id) DO NOTHING`,
      [
        conversa_id,
        reactionMsgId,
        owner,
        session.user.nome,
        emoji,
        JSON.stringify({ reacted_to: wa_message_id, sent_by: session.user.id }),
      ],
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/mensagens/react] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
