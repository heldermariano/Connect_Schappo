import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const UAZAPI_URL = process.env.UAZAPI_URL || '';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';

// Cache simples em memoria para URLs ja baixadas (evitar chamadas repetidas)
const urlCache = new Map<number, { url: string; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const id = parseInt(messageId);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    // Buscar mensagem no banco
    const result = await pool.query(
      `SELECT wa_message_id, tipo_mensagem, media_mimetype, media_filename FROM atd.mensagens WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const msg = result.rows[0];
    const waMessageId = msg.wa_message_id;

    if (!waMessageId || !UAZAPI_URL || !UAZAPI_TOKEN) {
      return NextResponse.json({ error: 'media_unavailable' }, { status: 404 });
    }

    // Verificar cache de URL
    let fileUrl: string | null = null;
    const cached = urlCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      fileUrl = cached.url;
    }

    if (!fileUrl) {
      // Determinar se deve gerar MP3 (para audios PTT/ogg)
      const isAudio = msg.tipo_mensagem === 'audio';
      const generateMp3 = isAudio ? 'true' : 'false';

      // Chamar UAZAPI /message/download
      const downloadResp = await fetch(`${UAZAPI_URL}/message/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: UAZAPI_TOKEN,
        },
        body: JSON.stringify({
          id: waMessageId,
          return_link: true,
          generate_mp3: generateMp3,
        }),
      });

      if (!downloadResp.ok) {
        console.error(`[media proxy] UAZAPI download falhou: ${downloadResp.status}`);
        const errStatus = downloadResp.status === 404 ? 404 : 502;
        return NextResponse.json({ error: 'media_unavailable', message: 'Midia nao disponivel' }, { status: errStatus });
      }

      const data = await downloadResp.json();
      fileUrl = data.fileURL || data.fileUrl || data.url;

      if (!fileUrl) {
        return NextResponse.json({ error: 'no_url_returned' }, { status: 502 });
      }

      // Cachear URL
      urlCache.set(id, { url: fileUrl, expiresAt: Date.now() + CACHE_TTL });
    }

    // Fazer fetch do arquivo e servir como stream (em vez de redirect)
    let fileResp = await fetch(fileUrl);
    if (!fileResp.ok && cached) {
      // URL do cache expirou, tentar obter nova URL da UAZAPI
      urlCache.delete(id);
      const isAudioRetry = msg.tipo_mensagem === 'audio';
      const retryResp = await fetch(`${UAZAPI_URL}/message/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: UAZAPI_TOKEN },
        body: JSON.stringify({ id: waMessageId, return_link: true, generate_mp3: isAudioRetry ? 'true' : 'false' }),
      });
      if (retryResp.ok) {
        const retryData = await retryResp.json();
        const retryUrl = retryData.fileURL || retryData.fileUrl || retryData.url;
        if (retryUrl) {
          urlCache.set(id, { url: retryUrl, expiresAt: Date.now() + CACHE_TTL });
          fileResp = await fetch(retryUrl);
        }
      }
    }
    if (!fileResp.ok) {
      urlCache.delete(id);
      return NextResponse.json({ error: 'media_unavailable', message: 'Midia nao disponivel no momento' }, { status: 404 });
    }

    const contentType = msg.media_mimetype || fileResp.headers.get('content-type') || 'application/octet-stream';
    const filename = msg.media_filename || 'arquivo';

    // PDFs e midias inline abrem no browser, outros tipos fazem download
    const isPdf = contentType === 'application/pdf';
    const isImage = contentType.startsWith('image/');
    const isAudioType = contentType.startsWith('audio/');
    const isVideo = contentType.startsWith('video/');
    const disposition = (isPdf || isImage || isAudioType || isVideo)
      ? 'inline'
      : `attachment; filename="${encodeURIComponent(filename)}"`;

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=1800', // 30 min
    });

    const contentLength = fileResp.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new Response(fileResp.body, { headers });
  } catch (err) {
    console.error('[media proxy] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
