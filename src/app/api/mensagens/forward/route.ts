import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { CATEGORIA_OWNER, getUazapiToken, extractUazapiMessageIds } from '@/lib/types';

const UAZAPI_URL = process.env.UAZAPI_URL || '';
const DIALOG360_API_URL = process.env.DIALOG360_API_URL || '';
const DIALOG360_API_KEY = process.env.DIALOG360_API_KEY || '';

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

const MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker'];

function getMediaType(mimetype: string): 'image' | 'audio' | 'video' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

// === Download de midia da mensagem original ===

async function downloadFromUAZAPI(waMessageId: string, token: string): Promise<Buffer | null> {
  if (!UAZAPI_URL || !token) return null;
  try {
    const resp = await fetch(`${UAZAPI_URL}/message/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ id: waMessageId, return_link: true }),
    });
    if (!resp.ok) {
      console.error(`[forward] UAZAPI download falhou: ${resp.status} msgId=${waMessageId}`);
      return null;
    }
    const data = await resp.json();
    const fileUrl = data.fileURL || data.fileUrl || data.url;
    if (!fileUrl) return null;

    const fileResp = await fetch(fileUrl);
    if (!fileResp.ok) return null;
    return Buffer.from(await fileResp.arrayBuffer());
  } catch (err) {
    console.error('[forward] Erro download UAZAPI:', err);
    return null;
  }
}

async function downloadFrom360Dialog(mediaId: string): Promise<Buffer | null> {
  if (!DIALOG360_API_URL || !DIALOG360_API_KEY || !mediaId) return null;
  try {
    // Obter URL da midia
    const infoResp = await fetch(`${DIALOG360_API_URL}/${mediaId}`, {
      headers: { 'D360-API-KEY': DIALOG360_API_KEY },
    });
    if (!infoResp.ok) return null;
    const info = await infoResp.json();
    let mediaUrl = info.url;
    if (!mediaUrl) return null;

    // Reescrever URL Facebook CDN para proxy 360Dialog
    try {
      const parsed = new URL(mediaUrl);
      if (parsed.hostname.includes('fbsbx.com') || parsed.hostname.includes('facebook.com') || parsed.hostname.includes('fbcdn.net')) {
        mediaUrl = `${DIALOG360_API_URL}${parsed.pathname}${parsed.search}`;
      }
    } catch { /* url ok */ }

    const fileResp = await fetch(mediaUrl, {
      headers: { 'D360-API-KEY': DIALOG360_API_KEY },
    });
    if (!fileResp.ok) return null;
    return Buffer.from(await fileResp.arrayBuffer());
  } catch (err) {
    console.error('[forward] Erro download 360Dialog:', err);
    return null;
  }
}

// === Envio de midia para o destino ===

async function sendMediaViaUAZAPI(
  number: string, mediaType: string, fileBuffer: Buffer,
  filename: string, mimetype: string, token: string, caption?: string,
): Promise<{ success: boolean; messageId?: string; fullMessageId?: string; error?: string }> {
  if (!UAZAPI_URL || !token) return { success: false, error: 'UAZAPI nao configurado' };
  try {
    const base64Data = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;
    const body: Record<string, string> = { number, type: mediaType, file: base64Data };
    if (caption) body.text = caption;
    if (mediaType === 'document') body.docName = filename;

    const res = await fetch(`${UAZAPI_URL}/send/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { success: false, error: `UAZAPI ${res.status}` };
    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch {
    return { success: false, error: 'Erro de conexao UAZAPI' };
  }
}

async function sendMediaVia360Dialog(
  to: string, mediaType: string, fileBuffer: Buffer,
  filename: string, mimetype: string, caption?: string,
): Promise<{ success: boolean; messageId?: string; mediaId?: string; error?: string }> {
  const apiUrl = DIALOG360_API_URL;
  const apiKey = DIALOG360_API_KEY;
  if (!apiUrl || !apiKey) return { success: false, error: '360Dialog nao configurado' };
  try {
    // Upload
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimetype });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimetype);

    const uploadRes = await fetch(`${apiUrl}/media`, {
      method: 'POST',
      headers: { 'D360-API-KEY': apiKey },
      body: formData,
    });
    if (!uploadRes.ok) return { success: false, error: `Upload 360Dialog ${uploadRes.status}` };
    const uploadData = await uploadRes.json();
    const mediaId = uploadData.id;

    // Send
    const sendType = mediaType === 'ptt' ? 'audio' : mediaType;
    const mediaPayload: Record<string, unknown> = { id: mediaId };
    if (caption && ['image', 'video', 'document'].includes(sendType)) mediaPayload.caption = caption;
    if (sendType === 'document') mediaPayload.filename = filename;

    const sendRes = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual',
        to, type: sendType, [sendType]: mediaPayload,
      }),
    });
    if (!sendRes.ok) return { success: false, error: `Send 360Dialog ${sendRes.status}` };
    const sendData = await sendRes.json();
    return { success: true, messageId: sendData.messages?.[0]?.id, mediaId };
  } catch {
    return { success: false, error: 'Erro de conexao 360Dialog' };
  }
}

// === Envio de texto ===

async function sendTextUAZAPI(number: string, text: string, token: string): Promise<{ success: boolean; messageId?: string; fullMessageId?: string; error?: string }> {
  if (!UAZAPI_URL || !token) return { success: false, error: 'UAZAPI nao configurado' };
  try {
    const res = await fetch(`${UAZAPI_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) return { success: false, error: `UAZAPI ${res.status}` };
    const data = await res.json();
    const ids = extractUazapiMessageIds(data);
    return { success: true, messageId: ids.shortId, fullMessageId: ids.fullId };
  } catch {
    return { success: false, error: 'Erro de conexao UAZAPI' };
  }
}

async function sendText360(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiUrl = DIALOG360_API_URL;
  const apiKey = DIALOG360_API_KEY;
  if (!apiUrl || !apiKey) return { success: false, error: '360Dialog nao configurado' };
  try {
    const res = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'text', text: { body: text },
      }),
    });
    if (!res.ok) return { success: false, error: `360Dialog ${res.status}` };
    const data = await res.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch {
    return { success: false, error: 'Erro de conexao 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { source_message_id, target_conversa_id } = await request.json();

    if (!source_message_id || !target_conversa_id) {
      return NextResponse.json({ error: 'source_message_id e target_conversa_id sao obrigatorios' }, { status: 400 });
    }

    // Buscar mensagem original + categoria da conversa de origem (para token correto)
    const msgResult = await pool.query(
      `SELECT m.*, c.categoria AS source_categoria, c.provider AS source_provider
       FROM atd.mensagens m
       LEFT JOIN atd.conversas c ON m.conversa_id = c.id
       WHERE m.id = $1`,
      [source_message_id],
    );
    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }
    const originalMsg = msgResult.rows[0];

    // Buscar conversa destino
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone
       FROM atd.conversas WHERE id = $1`,
      [target_conversa_id],
    );
    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa destino nao encontrada' }, { status: 404 });
    }
    const conversa = conversaResult.rows[0];

    // Verificar permissao
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;
    if (!categoriasPermitidas.includes(conversa.categoria)) {
      return NextResponse.json({ error: 'Sem permissao para esta conversa' }, { status: 403 });
    }

    const isGroup = conversa.tipo === 'grupo';
    const destinatario = isGroup
      ? conversa.wa_chatid
      : conversa.wa_chatid.replace('@s.whatsapp.net', '');

    const senderLabel = originalMsg.sender_name || originalMsg.sender_phone || 'Desconhecido';
    const nomeOperador = session.user.nome;
    const isMedia = MEDIA_TYPES.includes(originalMsg.tipo_mensagem);

    let sendResult: { success: boolean; messageId?: string; fullMessageId?: string; mediaId?: string; error?: string };
    let dbTipoMensagem = 'text';
    let dbConteudo: string;
    let dbMediaMimetype: string | null = null;
    let dbMediaFilename: string | null = null;

    if (isMedia) {
      // === Encaminhamento de MIDIA ===
      const meta = typeof originalMsg.metadata === 'string' ? JSON.parse(originalMsg.metadata) : (originalMsg.metadata || {});
      const sourceProvider = meta.provider || originalMsg.source_provider || 'uazapi';

      // Baixar midia da mensagem original
      let fileBuffer: Buffer | null = null;
      if (sourceProvider === '360dialog' && meta.dialog360_media_id) {
        fileBuffer = await downloadFrom360Dialog(meta.dialog360_media_id);
      } else {
        const waId = meta.message_id_full || originalMsg.wa_message_id;
        const sourceToken = getUazapiToken(originalMsg.source_categoria || 'geral');
        fileBuffer = await downloadFromUAZAPI(waId, sourceToken);
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        console.error(`[forward] Nao conseguiu baixar midia da msg ${source_message_id}, enviando como texto`);
        // Fallback: enviar como texto
        const conteudoOriginal = originalMsg.conteudo || `[${originalMsg.tipo_mensagem}]`;
        const textToSend = `*${nomeOperador}:*\n_Encaminhada de ${senderLabel}:_\n${conteudoOriginal}`;
        dbConteudo = conteudoOriginal;

        if (conversa.provider === '360dialog') {
          const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
          sendResult = await sendText360(to, textToSend);
        } else {
          sendResult = await sendTextUAZAPI(destinatario, textToSend, getUazapiToken(conversa.categoria));
        }
      } else {
        // Enviar midia para o destino
        const mimetype = (originalMsg.media_mimetype || 'application/octet-stream').split(';')[0].trim();
        const filename = originalMsg.media_filename || 'arquivo';
        const mediaType = getMediaType(mimetype);
        const caption = `*${nomeOperador}:*\n_Encaminhada de ${senderLabel}_`;

        console.log(`[forward] Midia: tipo=${mediaType} mime=${mimetype} file=${filename} size=${fileBuffer.length} dest=${conversa.provider}`);

        dbTipoMensagem = mediaType;
        dbMediaMimetype = mimetype;
        dbMediaFilename = filename;
        dbConteudo = originalMsg.conteudo || `[${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Audio' : mediaType === 'video' ? 'Video' : 'Documento'}]`;

        if (conversa.provider === '360dialog') {
          const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
          sendResult = await sendMediaVia360Dialog(to, mediaType, fileBuffer, filename, mimetype, caption);
        } else {
          sendResult = await sendMediaViaUAZAPI(destinatario, mediaType, fileBuffer, filename, mimetype, getUazapiToken(conversa.categoria), caption);
        }
      }
    } else {
      // === Encaminhamento de TEXTO ===
      const conteudoOriginal = originalMsg.conteudo || '';
      const textToSend = `*${nomeOperador}:*\n_Encaminhada de ${senderLabel}:_\n${conteudoOriginal}`;
      dbConteudo = conteudoOriginal;

      if (conversa.provider === '360dialog') {
        const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
        sendResult = await sendText360(to, textToSend);
      } else {
        sendResult = await sendTextUAZAPI(destinatario, textToSend, getUazapiToken(conversa.categoria));
      }
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao encaminhar' }, { status: 502 });
    }

    // Salvar no banco
    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `fwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const metadata: Record<string, unknown> = {
      forwarded_from_msg_id: source_message_id,
      forwarded_by: session.user.id,
      forwarded_by_name: session.user.nome,
      original_sender: senderLabel,
      message_id_full: sendResult.fullMessageId || waMessageId,
      provider: conversa.provider,
    };
    if (sendResult.mediaId) {
      metadata.dialog360_media_id = sendResult.mediaId;
    }

    const newMsgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, media_mimetype, media_filename,
        is_forwarded, status, metadata
      ) VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, true, 'sent', $9)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        target_conversa_id,
        waMessageId,
        owner,
        session.user.nome,
        dbTipoMensagem,
        dbConteudo,
        dbMediaMimetype,
        dbMediaFilename,
        JSON.stringify(metadata),
      ],
    );

    if (newMsgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    const mensagem = newMsgResult.rows[0];

    // Atualizar conversa destino
    await pool.query(
      `UPDATE atd.conversas SET
        ultima_mensagem = LEFT($1, 200),
        ultima_msg_at = NOW(),
        nao_lida = 0,
        updated_at = NOW()
       WHERE id = $2`,
      [dbConteudo, target_conversa_id],
    );

    // Emitir SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id: target_conversa_id, mensagem, categoria: conversa.categoria, tipo: conversa.tipo },
    });

    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: target_conversa_id,
        ultima_msg: dbConteudo.substring(0, 200),
        nao_lida: 0,
      },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/forward] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
