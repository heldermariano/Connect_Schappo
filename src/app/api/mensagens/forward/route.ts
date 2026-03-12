import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUazapiToken } from '@/lib/types';
import { requireAuth, isAuthed, apiError } from '@/lib/api-auth';
import { sendTextUAZAPI, sendMediaUAZAPI, sendText360Dialog, sendMedia360Dialog } from '@/lib/whatsapp-provider';
import {
  saveOutgoingMessage, updateConversaAfterSend, broadcastNewMessage,
  formatRecipient, generateMessageId, buildSendMetadata,
} from '@/lib/conversa-update';
import type { SendResult } from '@/lib/conversa-update';

const UAZAPI_URL = process.env.UAZAPI_URL || '';
const DIALOG360_API_URL = process.env.DIALOG360_API_URL || '';
const DIALOG360_API_KEY = process.env.DIALOG360_API_KEY || '';

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

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

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
    if (!auth.categoriasPermitidas.includes(conversa.categoria)) {
      return apiError('Sem permissao para esta conversa', 403);
    }

    const destinatario = formatRecipient(conversa.wa_chatid, conversa.tipo, conversa.provider);

    const senderLabel = originalMsg.sender_name || originalMsg.sender_phone || 'Desconhecido';
    const nomeOperador = auth.session.user.nome;
    const isMedia = MEDIA_TYPES.includes(originalMsg.tipo_mensagem);

    let sendResult: SendResult;
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
          sendResult = await sendText360Dialog(destinatario, textToSend);
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
          sendResult = await sendMedia360Dialog(destinatario, mediaType, fileBuffer, filename, mimetype, caption);
        } else {
          const base64Data = fileBuffer.toString('base64');
          sendResult = await sendMediaUAZAPI(destinatario, mediaType, base64Data, mimetype, filename, getUazapiToken(conversa.categoria), caption);
        }
      }
    } else {
      // === Encaminhamento de TEXTO ===
      const conteudoOriginal = originalMsg.conteudo || '';
      const textToSend = `*${nomeOperador}:*\n_Encaminhada de ${senderLabel}:_\n${conteudoOriginal}`;
      dbConteudo = conteudoOriginal;

      if (conversa.provider === '360dialog') {
        sendResult = await sendText360Dialog(destinatario, textToSend);
      } else {
        sendResult = await sendTextUAZAPI(destinatario, textToSend, getUazapiToken(conversa.categoria));
      }
    }

    if (!sendResult.success) {
      console.error(`[forward] Falha ao encaminhar msg ${source_message_id} para conversa ${target_conversa_id}: ${sendResult.error}`);
      return NextResponse.json({ error: sendResult.error || 'Falha ao encaminhar' }, { status: 502 });
    }

    console.log(`[forward] Envio OK: msg ${source_message_id} → conversa ${target_conversa_id}, messageId=${sendResult.messageId}`);

    // Salvar no banco via helper
    const waMessageId = sendResult.messageId || generateMessageId('fwd');

    const metadata = buildSendMetadata(
      auth.session.user.id as string,
      auth.session.user.nome,
      sendResult,
      {
        forwarded_from_msg_id: source_message_id,
        forwarded_by: auth.session.user.id,
        forwarded_by_name: auth.session.user.nome,
        original_sender: senderLabel,
        provider: conversa.provider,
      },
    );

    const mensagem = await saveOutgoingMessage(pool, {
      conversa_id: target_conversa_id,
      wa_message_id: waMessageId,
      tipo_mensagem: dbTipoMensagem,
      conteudo: dbConteudo,
      sender_name: auth.session.user.nome,
      categoria: conversa.categoria,
      metadata,
      media_mimetype: dbMediaMimetype,
      media_filename: dbMediaFilename,
      is_forwarded: true,
    });

    if (!mensagem) {
      console.error(`[forward] Duplicada: wa_message_id=${waMessageId} para msg ${source_message_id}`);
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    // Atualizar conversa destino + broadcast SSE conversa_atualizada
    await updateConversaAfterSend(pool, target_conversa_id, dbConteudo);

    // Broadcast SSE nova_mensagem
    broadcastNewMessage(target_conversa_id, mensagem, conversa.categoria, conversa.tipo);

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/forward] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
