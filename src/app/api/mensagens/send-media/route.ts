import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUazapiToken } from '@/lib/types';
import { requireAuth, isAuthed, apiError } from '@/lib/api-auth';
import { sendMediaUAZAPI, sendMedia360Dialog } from '@/lib/whatsapp-provider';
import {
  type SendResult,
  saveOutgoingMessage,
  updateConversaAfterSend,
  broadcastNewMessage,
  formatRecipient,
  generateMessageId,
  buildSendMetadata,
} from '@/lib/conversa-update';
import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Resolver path do ffmpeg-static (Turbopack reescreve require() com path errado)
function getFfmpegPath(): string {
  // Tentar ffmpeg do sistema primeiro
  try {
    execFileSync('ffmpeg', ['-version'], { timeout: 5000, stdio: 'ignore' });
    return 'ffmpeg';
  } catch { /* ffmpeg do sistema nao disponivel */ }

  // Tentar path relativo ao projeto (node_modules)
  const localPath = join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
  try {
    execFileSync(localPath, ['-version'], { timeout: 5000, stdio: 'ignore' });
    return localPath;
  } catch { /* nao encontrado */ }

  // Ultimo recurso: require
  try {
    const reqPath = require('ffmpeg-static') as string;
    return reqPath;
  } catch {
    throw new Error('ffmpeg nao encontrado (sistema, node_modules, nem ffmpeg-static)');
  }
}

// Converter audio (webm/mp4/etc) → ogg usando ffmpeg (remux opus codec)
function convertToOgg(buffer: Buffer): Buffer {
  const ffmpegPath = getFfmpegPath();

  const tmp = join(tmpdir(), 'connect-audio');
  try { mkdirSync(tmp, { recursive: true }); } catch { /* ok */ }
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const inputPath = join(tmp, `${id}.input`);
  const outputPath = join(tmp, `${id}.ogg`);

  try {
    writeFileSync(inputPath, buffer);
    // Tentar remux primeiro (rapido, sem re-encoding: opus→opus)
    // Se falhar (codec incompativel), re-encode com libopus
    try {
      execFileSync(ffmpegPath, [
        '-i', inputPath,
        '-c:a', 'copy',
        '-f', 'ogg',
        '-y', outputPath,
      ], { timeout: 15000 });
    } catch {
      // Remux falhou — re-encode
      execFileSync(ffmpegPath, [
        '-i', inputPath,
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-f', 'ogg',
        '-y', outputPath,
      ], { timeout: 30000 });
    }
    return readFileSync(outputPath);
  } finally {
    try { unlinkSync(inputPath); } catch { /* ok */ }
    try { unlinkSync(outputPath); } catch { /* ok */ }
  }
}


// Determina tipo de midia baseado no mimetype
function getMediaType(mimetype: string): 'image' | 'audio' | 'video' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  try {
    const formData = await request.formData();
    const conversaId = parseInt(formData.get('conversa_id') as string);
    const file = formData.get('file') as File | null;
    const caption = (formData.get('caption') as string)?.trim() || undefined;

    if (!conversaId || isNaN(conversaId)) {
      return NextResponse.json({ error: 'conversa_id e obrigatorio' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'Arquivo e obrigatorio' }, { status: 400 });
    }

    // Buscar conversa no banco
    const conversaResult = await pool.query(
      `SELECT id, wa_chatid, tipo, categoria, provider, telefone, nome_contato
       FROM atd.conversas WHERE id = $1`,
      [conversaId],
    );

    if (conversaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = conversaResult.rows[0];

    // Verificar permissao
    if (!auth.categoriasPermitidas.includes(conversa.categoria)) {
      return apiError('Sem permissao para esta conversa', 403);
    }

    const dest = formatRecipient(conversa.wa_chatid, conversa.tipo, conversa.provider);

    // Detectar MIME type: usar file.type do browser, com fallback por extensao
    let mimetype = file.type || '';
    if (!mimetype || mimetype === 'application/octet-stream') {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
        mp4: 'video/mp4', avi: 'video/x-msvideo', mov: 'video/quicktime',
        mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', aac: 'audio/aac',
        pdf: 'application/pdf', doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      mimetype = (ext && mimeMap[ext]) || 'application/octet-stream';
    }
    const isVoiceRecording = formData.get('voice_recording') === 'true';
    const mediaType = isVoiceRecording ? 'ptt' : getMediaType(mimetype);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Prefixar nome do operador em negrito no caption (visivel no WhatsApp)
    // PTT/audio nao suporta caption no WhatsApp
    const nomeOperador = auth.session.user.nome;
    const captionToSend = mediaType === 'ptt' ? undefined : (caption ? `*${nomeOperador}:*\n${caption}` : `*${nomeOperador}*`);

    console.log(`[send-media] provider=${conversa.provider} type=${mediaType} mime=${mimetype} file=${file.name} size=${fileBuffer.length} voice=${isVoiceRecording}`);

    // Enviar via provider correto
    let sendResult: SendResult;

    if (conversa.provider === '360dialog') {
      // Audio conversion para 360Dialog: converter formatos nao-ogg para ogg via ffmpeg
      let finalBuffer: Buffer = fileBuffer;
      let finalMimetype = mimetype.split(';')[0].trim();
      let finalFilename = file.name;
      const isAudioUpload = mediaType === 'audio' || mediaType === 'ptt';
      const isAlreadyOgg = finalMimetype === 'audio/ogg';

      if (isAudioUpload && !isAlreadyOgg) {
        try {
          finalBuffer = convertToOgg(fileBuffer);
          finalMimetype = 'audio/ogg';
          finalFilename = file.name.replace(/\.\w+$/, '.ogg');
          console.log(`[send-media/360dialog] Convertido ${mimetype}→ogg: ${fileBuffer.length}→${finalBuffer.length} bytes`);
        } catch (convErr) {
          console.error('[send-media/360dialog] Erro na conversao para ogg:', convErr);
          // Se falhar conversao, enviar como esta (melhor tentar do que nao enviar)
        }
      }

      // Normalizar MIME type para formatos aceitos pela Meta Cloud API
      if (finalMimetype === 'image/webp' || finalMimetype === 'image/bmp' || finalMimetype === 'image/tiff') {
        console.log(`[send-media/360dialog] Formato ${finalMimetype} nao suportado como imagem, convertendo tipo para document`);
      }

      sendResult = await sendMedia360Dialog(dest, mediaType, finalBuffer, finalFilename, finalMimetype, captionToSend, isVoiceRecording);
    } else {
      const uazapiToken = getUazapiToken(conversa.categoria);
      const base64 = fileBuffer.toString('base64');
      sendResult = await sendMediaUAZAPI(dest, mediaType, base64, mimetype, file.name, uazapiToken, captionToSend);
    }

    // Salvar mensagem no banco mesmo em caso de falha (permite reenvio)
    const waMessageId = sendResult.messageId || generateMessageId('sent_media');
    const dbMediaType = mediaType === 'ptt' ? 'audio' : mediaType;
    const conteudo = caption || `[${dbMediaType === 'image' ? 'Imagem' : dbMediaType === 'audio' ? 'Audio' : dbMediaType === 'video' ? 'Video' : 'Documento'}]`;
    const msgStatus = sendResult.success ? 'sent' : 'failed';

    if (!sendResult.success) {
      console.error(`[send-media] Falha: ${sendResult.error} provider=${conversa.provider} conversa=${conversaId}`);
    }

    const metadata = buildSendMetadata(
      auth.session.user.id,
      auth.session.user.nome,
      sendResult,
      { provider: conversa.provider },
    );

    const mensagem = await saveOutgoingMessage(pool, {
      conversa_id: conversaId,
      wa_message_id: waMessageId,
      tipo_mensagem: dbMediaType,
      conteudo,
      sender_name: auth.session.user.nome,
      categoria: conversa.categoria,
      status: msgStatus,
      metadata,
      media_mimetype: mimetype,
      media_filename: file.name,
    });

    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    // Emitir SSE (nova_mensagem sempre — para mostrar no painel, inclusive com status failed)
    broadcastNewMessage(conversaId, mensagem, conversa.categoria, conversa.tipo);

    if (sendResult.success) {
      // Atualizar conversa apenas quando envio foi bem-sucedido
      await updateConversaAfterSend(pool, conversaId, conteudo);

      return NextResponse.json({ success: true, mensagem });
    } else {
      return NextResponse.json({ success: false, error: sendResult.error, mensagem }, { status: 502 });
    }
  } catch (err) {
    console.error('[api/mensagens/send-media] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
