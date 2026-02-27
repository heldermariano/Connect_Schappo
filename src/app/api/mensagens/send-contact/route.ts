import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { CATEGORIA_OWNER, getUazapiToken, normalizePhone } from '@/lib/types';

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

async function sendContactViaUAZAPI(
  number: string,
  contactName: string,
  contactPhone: string,
  instanceToken: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  const token = instanceToken;
  if (!url || !token) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const res = await fetch(`${url}/send/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({
        number,
        contact: [{
          name: { formatted_name: contactName, first_name: contactName },
          phones: [{ phone: contactPhone, type: 'CELL' }],
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send-contact/uazapi] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id || data.messageid || data.messageId };
  } catch (err) {
    console.error('[send-contact/uazapi] Erro:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

async function sendContactVia360Dialog(
  to: string,
  contactName: string,
  contactPhone: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'contacts',
        contacts: [{
          name: { formatted_name: contactName, first_name: contactName },
          phones: [{ phone: contactPhone, type: 'CELL' }],
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send-contact/360dialog] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[send-contact/360dialog] Erro:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

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

    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;
    if (!categoriasPermitidas.includes(conversa.categoria)) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
    }

    const rawDest = conversa.telefone || conversa.wa_chatid.replace('@s.whatsapp.net', '');
    const destinatario = conversa.tipo === 'grupo'
      ? conversa.wa_chatid
      : (normalizePhone(rawDest) || rawDest);

    let sendResult: { success: boolean; messageId?: string; error?: string };
    if (conversa.provider === '360dialog') {
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendContactVia360Dialog(to, contact_name, contact_phone);
    } else {
      const uazapiToken = getUazapiToken(conversa.categoria);
      sendResult = await sendContactViaUAZAPI(destinatario, contact_name, contact_phone, uazapiToken);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao enviar' }, { status: 502 });
    }

    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `sent_contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conteudoTexto = `👤 ${contact_name}\n${contact_phone}`;

    const msgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, status, metadata
      ) VALUES ($1, $2, true, $3, $4, 'contacts', $5, 'sent', $6)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        conversa_id,
        waMessageId,
        owner,
        session.user.nome,
        conteudoTexto,
        JSON.stringify({ contact_name, contact_phone, sent_by: session.user.id }),
      ],
    );

    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    const mensagem = msgResult.rows[0];

    await pool.query(
      `UPDATE atd.conversas SET
        ultima_mensagem = LEFT($1, 200), ultima_msg_at = NOW(),
        ultima_msg_from_me = TRUE, nao_lida = 0, updated_at = NOW()
       WHERE id = $2`,
      [conteudoTexto, conversa_id],
    );

    sseManager.broadcast({ type: 'nova_mensagem', data: { conversa_id, mensagem, categoria: conversa.categoria } });
    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: { conversa_id, ultima_msg: conteudoTexto.substring(0, 200), nao_lida: 0 },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/send-contact] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
