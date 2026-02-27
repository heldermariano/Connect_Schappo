import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { CATEGORIA_OWNER, getUazapiToken } from '@/lib/types';
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

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

// Determina tipo de midia baseado no mimetype
function getMediaType(mimetype: string): 'image' | 'audio' | 'video' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

// Envia midia via UAZAPI usando endpoint unificado /send/media
// Campos conforme doc: number, type, file, text (caption), docName, replyid, mentions
async function sendMediaViaUAZAPI(
  number: string,
  mediaType: string,
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
  instanceToken: string,
  caption?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  if (!url || !instanceToken) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const base64Data = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;

    const body: Record<string, string> = {
      number,
      type: mediaType,
      file: base64Data,
    };

    // text = caption/legenda
    if (caption) {
      body.text = caption;
    }

    // docName para documentos (aparece como titulo no WhatsApp)
    if (mediaType === 'document') {
      body.docName = filename;
    }

    const res = await fetch(`${url}/send/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: instanceToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const respBody = await res.text();
      console.error(`[send-media/uazapi] Erro: ${res.status}`, respBody);
      return { success: false, error: `UAZAPI retornou ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id || data.messageid || data.messageId };
  } catch (err) {
    console.error('[send-media/uazapi] Erro de rede:', err);
    return { success: false, error: 'Erro de conexao com UAZAPI' };
  }
}

// Envia midia via 360Dialog
async function sendMediaVia360Dialog(
  to: string,
  mediaType: string,
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
  caption?: string,
  isVoiceRecording?: boolean,
): Promise<{ success: boolean; messageId?: string; mediaId?: string; error?: string }> {
  const apiUrl = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!apiUrl || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    // Primeiro, upload da midia
    // 360Dialog (Meta Cloud API) aceita: audio/ogg, audio/aac, audio/mp4, audio/mpeg, audio/amr
    // NAO aceita: audio/webm. audio/mp4 do MediaRecorder tambem nao entrega (aceita upload mas nao envia).
    // Solucao: converter qualquer audio nao-ogg para ogg via ffmpeg (remux opus codec)
    // Limpar MIME: remover parametros de codecs (ex: audio/ogg;codecs=opus → audio/ogg)
    let uploadMimetype = mimetype.split(';')[0].trim();
    let uploadFilename = filename;
    let uploadBuffer = fileBuffer;
    const isAudioUpload = mediaType === 'audio' || mediaType === 'ptt';
    const isAlreadyOgg = uploadMimetype === 'audio/ogg';
    if (isAudioUpload && !isAlreadyOgg) {
      // Converter webm/mp4/qualquer formato para ogg via ffmpeg
      try {
        uploadBuffer = convertToOgg(fileBuffer);
        uploadMimetype = 'audio/ogg';
        uploadFilename = filename.replace(/\.\w+$/, '.ogg');
        console.log(`[send-media/360dialog] Convertido ${mimetype}→ogg: ${fileBuffer.length}→${uploadBuffer.length} bytes`);
      } catch (convErr) {
        console.error('[send-media/360dialog] Erro na conversao para ogg:', convErr);
        // Se falhar conversao, enviar como esta (melhor tentar do que nao enviar)
      }
    }

    // Normalizar MIME type para formatos aceitos pela Meta Cloud API
    // Imagens: image/jpeg, image/png (webp precisa converter para png)
    if (uploadMimetype === 'image/webp' || uploadMimetype === 'image/bmp' || uploadMimetype === 'image/tiff') {
      // Para formatos nao suportados, enviar como document em vez de rejeitar
      console.log(`[send-media/360dialog] Formato ${uploadMimetype} nao suportado como imagem, convertendo tipo para document`);
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(uploadBuffer)], { type: uploadMimetype });
    formData.append('file', blob, uploadFilename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', uploadMimetype);

    const uploadRes = await fetch(`${apiUrl}/media`, {
      method: 'POST',
      headers: { 'D360-API-KEY': apiKey },
      body: formData,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      console.error(`[send-media/360dialog] Upload falhou (${uploadRes.status}): mime=${uploadMimetype} file=${uploadFilename}`, body);
      return { success: false, error: `Upload falhou: ${uploadRes.status}` };
    }

    const uploadData = await uploadRes.json();
    const mediaId = uploadData.id;
    console.log(`[send-media/360dialog] Upload OK: mediaId=${mediaId} mime=${uploadMimetype} voice=${isVoiceRecording}`);

    // Enviar mensagem com a midia
    // Meta Cloud API usa 'audio' como tipo (nao 'ptt')
    const sendType = (mediaType === 'ptt') ? 'audio' : mediaType;
    const mediaPayload: Record<string, unknown> = { id: mediaId };
    if (caption && (sendType === 'image' || sendType === 'video' || sendType === 'document')) {
      mediaPayload.caption = caption;
    }
    if (sendType === 'document') {
      mediaPayload.filename = filename;
    }
    // Voice message (PTT): adicionar voice=true para reproduzir como mensagem de voz
    if (isVoiceRecording) {
      mediaPayload.voice = true;
    }

    const sendRes = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: sendType,
        [sendType]: mediaPayload,
      }),
    });

    if (!sendRes.ok) {
      const body = await sendRes.text();
      console.error(`[send-media/360dialog] Send falhou (${sendRes.status}): type=${sendType} voice=${isVoiceRecording}`, body);
      return { success: false, error: `Send falhou: ${sendRes.status}` };
    }

    const sendData = await sendRes.json();
    console.log(`[send-media/360dialog] Send OK: msgId=${sendData.messages?.[0]?.id} type=${sendType} voice=${isVoiceRecording}`);
    return { success: true, messageId: sendData.messages?.[0]?.id, mediaId };
  } catch (err) {
    console.error('[send-media/360dialog] Erro:', err);
    return { success: false, error: 'Erro de conexao com 360Dialog' };
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

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
    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;
    if (!categoriasPermitidas.includes(conversa.categoria)) {
      return NextResponse.json({ error: 'Sem permissao para esta conversa' }, { status: 403 });
    }

    const isGroup = conversa.tipo === 'grupo';
    let destinatario: string;
    if (isGroup) {
      destinatario = conversa.wa_chatid;
    } else {
      destinatario = conversa.telefone || conversa.wa_chatid.replace('@s.whatsapp.net', '');
    }

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
    const nomeOperador = session.user.nome;
    const captionToSend = mediaType === 'ptt' ? undefined : (caption ? `*${nomeOperador}:*\n${caption}` : `*${nomeOperador}*`);

    console.log(`[send-media] provider=${conversa.provider} type=${mediaType} mime=${mimetype} file=${file.name} size=${fileBuffer.length} voice=${isVoiceRecording}`);

    // Enviar via provider correto
    let sendResult: { success: boolean; messageId?: string; mediaId?: string; error?: string };

    if (conversa.provider === '360dialog') {
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendMediaVia360Dialog(to, mediaType, fileBuffer, file.name, mimetype, captionToSend, isVoiceRecording);
    } else {
      const uazapiToken = getUazapiToken(conversa.categoria);
      sendResult = await sendMediaViaUAZAPI(destinatario, mediaType, fileBuffer, file.name, mimetype, uazapiToken, captionToSend);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao enviar midia' }, { status: 502 });
    }

    // Salvar mensagem no banco (tipo_mensagem no banco sempre usa tipo generico, nao ptt)
    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dbMediaType = mediaType === 'ptt' ? 'audio' : mediaType;
    const conteudo = caption || `[${dbMediaType === 'image' ? 'Imagem' : dbMediaType === 'audio' ? 'Audio' : dbMediaType === 'video' ? 'Video' : 'Documento'}]`;

    // Metadata: incluir provider e media_id da 360Dialog para o media proxy
    const metadata: Record<string, unknown> = {
      sent_by: session.user.id,
      sent_by_name: session.user.nome,
      provider: conversa.provider,
    };
    if (sendResult.mediaId) {
      metadata.dialog360_media_id = sendResult.mediaId;
    }

    const msgResult = await pool.query(
      `INSERT INTO atd.mensagens (
        conversa_id, wa_message_id, from_me, sender_phone, sender_name,
        tipo_mensagem, conteudo, media_mimetype, media_filename, status, metadata
      ) VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, 'sent', $9)
      ON CONFLICT (wa_message_id) DO NOTHING
      RETURNING *`,
      [
        conversaId,
        waMessageId,
        owner,
        session.user.nome,
        dbMediaType,
        conteudo,
        mimetype,
        file.name,
        JSON.stringify(metadata),
      ],
    );

    if (msgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem duplicada' }, { status: 409 });
    }

    const mensagem = msgResult.rows[0];

    // Atualizar conversa
    await pool.query(
      `UPDATE atd.conversas SET
        ultima_mensagem = LEFT($1, 200),
        ultima_msg_at = NOW(),
        nao_lida = 0,
        updated_at = NOW()
       WHERE id = $2`,
      [conteudo, conversaId],
    );

    // Emitir SSE
    sseManager.broadcast({
      type: 'nova_mensagem',
      data: { conversa_id: conversaId, mensagem, categoria: conversa.categoria, tipo: conversa.tipo },
    });

    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: conversaId,
        ultima_msg: conteudo.substring(0, 200),
        nao_lida: 0,
      },
    });

    return NextResponse.json({ success: true, mensagem });
  } catch (err) {
    console.error('[api/mensagens/send-media] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
