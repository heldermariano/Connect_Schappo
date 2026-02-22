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

  // Verificar cache
  const cached = urlCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.redirect(cached.url);
  }

  try {
    // Buscar mensagem no banco
    const result = await pool.query(
      `SELECT wa_message_id, tipo_mensagem, media_mimetype FROM atd.mensagens WHERE id = $1`,
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
      return NextResponse.json({ error: 'download_failed' }, { status: 502 });
    }

    const data = await downloadResp.json();

    // UAZAPI retorna { fileURL: "https://..." } quando return_link=true
    const fileUrl = data.fileURL || data.fileUrl || data.url;

    if (fileUrl) {
      // Cachear URL
      urlCache.set(id, { url: fileUrl, expiresAt: Date.now() + CACHE_TTL });
      return NextResponse.redirect(fileUrl);
    }

    // Se nao retornou link, tentar fazer proxy do binario
    return NextResponse.json({ error: 'no_url_returned' }, { status: 502 });
  } catch (err) {
    console.error('[media proxy] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
