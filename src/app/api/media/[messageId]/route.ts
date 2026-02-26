import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const UAZAPI_URL = process.env.UAZAPI_URL || '';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const DIALOG360_API_URL = process.env.DIALOG360_API_URL || '';
const DIALOG360_API_KEY = process.env.DIALOG360_API_KEY || '';

// Cache simples em memoria para URLs ja baixadas (evitar chamadas repetidas)
const urlCache = new Map<number, { url: string; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// Baixa URL de midia via 360Dialog (Meta Cloud API)
async function get360DialogMediaUrl(mediaId: string): Promise<string | null> {
  if (!DIALOG360_API_URL || !DIALOG360_API_KEY || !mediaId) return null;

  try {
    const res = await fetch(`${DIALOG360_API_URL}/${mediaId}`, {
      headers: { 'D360-API-KEY': DIALOG360_API_KEY },
    });

    if (!res.ok) {
      console.error(`[media proxy] 360Dialog media fetch falhou: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error('[media proxy] 360Dialog erro:', err);
    return null;
  }
}

// Baixa midia usando URL da 360Dialog (precisa do header de auth)
async function fetch360DialogMedia(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { 'D360-API-KEY': DIALOG360_API_KEY },
    });
    if (!res.ok) {
      console.error(`[media proxy] 360Dialog download falhou: ${res.status}`);
      return null;
    }
    return res;
  } catch (err) {
    console.error('[media proxy] 360Dialog download erro:', err);
    return null;
  }
}

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
    // Buscar mensagem no banco (incluir metadata para message_id_full e provider)
    const result = await pool.query(
      `SELECT wa_message_id, tipo_mensagem, media_mimetype, media_filename, metadata FROM atd.mensagens WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const msg = result.rows[0];
    const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata || {});

    // Detectar provider: 360Dialog ou UAZAPI
    const is360Dialog = meta.provider === '360dialog' || !!meta.dialog360_media_id;

    let fileResp: Response | null = null;

    if (is360Dialog) {
      // === 360Dialog: baixar via API da Meta ===
      const dialog360MediaId = meta.dialog360_media_id;
      if (!dialog360MediaId) {
        return NextResponse.json({ error: 'media_unavailable', message: 'Media ID da 360Dialog nao encontrado' }, { status: 404 });
      }

      // Verificar cache
      const cached = urlCache.get(id);
      let mediaUrl = cached && cached.expiresAt > Date.now() ? cached.url : null;

      if (!mediaUrl) {
        mediaUrl = await get360DialogMediaUrl(dialog360MediaId);
        if (!mediaUrl) {
          return NextResponse.json({ error: 'media_unavailable', message: 'Midia nao disponivel na 360Dialog' }, { status: 502 });
        }
        urlCache.set(id, { url: mediaUrl, expiresAt: Date.now() + CACHE_TTL });
      }

      // 360Dialog exige header de auth para baixar a midia
      fileResp = await fetch360DialogMedia(mediaUrl);

      // Se cache expirou, tentar obter nova URL
      if (!fileResp && cached) {
        urlCache.delete(id);
        mediaUrl = await get360DialogMediaUrl(dialog360MediaId);
        if (mediaUrl) {
          urlCache.set(id, { url: mediaUrl, expiresAt: Date.now() + CACHE_TTL });
          fileResp = await fetch360DialogMedia(mediaUrl);
        }
      }
    } else {
      // === UAZAPI: fluxo original ===
      const waMessageId = meta.message_id_full || msg.wa_message_id;

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
        const isAudio = msg.tipo_mensagem === 'audio';
        const generateMp3 = isAudio ? 'true' : 'false';

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

        urlCache.set(id, { url: fileUrl, expiresAt: Date.now() + CACHE_TTL });
      }

      fileResp = await fetch(fileUrl);
      if (!fileResp.ok && cached) {
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
    }

    if (!fileResp || !fileResp.ok) {
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
