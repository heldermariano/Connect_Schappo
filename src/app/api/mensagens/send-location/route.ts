import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { CATEGORIA_OWNER, getUazapiToken, normalizePhone, extractUazapiMessageIds } from '@/lib/types';

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

async function sendLocationViaUAZAPI(
  number: string,
  latitude: number,
  longitude: number,
  instanceToken: string,
  name?: string,
  address?: string,
): Promise<{ success: boolean; messageId?: string; fullMessageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  const token = instanceToken;
  if (!url || !token) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const payload: Record<string, unknown> = { number, latitude, longitude };
    if (name) payload.name = name;
    if (address) payload.address = address;

    const res = await fetch(`${url}/send/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send-location/uazapi] Erro:', res.status, body);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch (err) {
    console.error('[send-location/uazapi] Erro:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

async function sendLocationVia360Dialog(
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!url || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    const location: Record<string, unknown> = { latitude, longitude };
    if (name) location.name = name;
    if (address) location.address = address;

    const res = await fetch(`${url}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'location',
        location,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[send-location/360dialog] Erro:', res.status, body);
      return { success: false, error: `360Dialog retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[send-location/360dialog] Erro:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { conversa_id, latitude, longitude, name, address } = await request.json();

    if (!conversa_id || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'conversa_id, latitude e longitude sao obrigatorios' }, { status: 400 });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Coordenadas invalidas' }, { status: 400 });
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

    const destinatario = conversa.tipo === 'grupo'
      ? conversa.wa_chatid
      : conversa.wa_chatid.replace('@s.whatsapp.net', '');

    let sendResult: { success: boolean; messageId?: string; fullMessageId?: string; error?: string };
    if (conversa.provider === '360dialog') {
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendLocationVia360Dialog(to, lat, lng, name, address);
    } else {
      const uazapiToken = getUazapiToken(conversa.categoria);
      sendResult = await sendLocationViaUAZAPI(destinatario, lat, lng, uazapiToken, name, address);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao enviar' }, { status: 502 });
    }

    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `sent_loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conteudoTexto = `📍 ${name || 'Localização'}\n${address || `${lat}, ${lng}`}`;

    const msgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, status, metadata
      ) VALUES ($1, $2, true, $3, $4, 'location', $5, 'sent', $6)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        conversa_id,
        waMessageId,
        owner,
        session.user.nome,
        conteudoTexto,
        JSON.stringify({ latitude: lat, longitude: lng, name, address, sent_by: session.user.id, message_id_full: sendResult.fullMessageId || waMessageId }),
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
    console.error('[api/mensagens/send-location] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
