import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

// Mapeamento categoria → owner (numero que envia)
const CATEGORIA_OWNER: Record<string, string> = {
  eeg: '556192894339',
  recepcao: '556183008973',
  geral: '556133455701',
};

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

// Mapeia tipo de midia para endpoint UAZAPI especifico
function getUAZAPIEndpoint(mediaType: string): string {
  switch (mediaType) {
    case 'image': return '/send/image';
    case 'audio': return '/send/audio';
    case 'video': return '/send/video';
    case 'document': return '/send/document';
    default: return '/send/document';
  }
}

// Envia midia via UAZAPI usando endpoints especificos (/send/image, /send/document, etc.)
async function sendMediaViaUAZAPI(
  number: string,
  mediaType: string,
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
  caption?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = process.env.UAZAPI_URL;
  const token = process.env.UAZAPI_TOKEN;
  if (!url || !token) return { success: false, error: 'UAZAPI nao configurado' };

  try {
    const base64Data = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;
    const endpoint = getUAZAPIEndpoint(mediaType);

    const body: Record<string, string> = {
      number,
      file: base64Data,
      caption: caption || '',
    };

    // Campo filename para documentos (aparece como titulo no WhatsApp)
    if (mediaType === 'document') {
      body.filename = filename;
    }

    const res = await fetch(`${url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
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
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiUrl = process.env.DIALOG360_API_URL;
  const apiKey = process.env.DIALOG360_API_KEY;
  if (!apiUrl || !apiKey) return { success: false, error: '360Dialog nao configurado' };

  try {
    // Primeiro, upload da midia
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimetype });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mediaType);

    const uploadRes = await fetch(`${apiUrl}/media`, {
      method: 'POST',
      headers: { 'D360-API-KEY': apiKey },
      body: formData,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      console.error('[send-media/360dialog] Upload falhou:', body);
      return { success: false, error: `Upload falhou: ${uploadRes.status}` };
    }

    const uploadData = await uploadRes.json();
    const mediaId = uploadData.id;

    // Enviar mensagem com a midia
    const mediaPayload: Record<string, unknown> = { id: mediaId };
    if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
      mediaPayload.caption = caption;
    }
    if (mediaType === 'document') {
      mediaPayload.filename = filename;
    }

    const sendRes = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: mediaPayload,
      }),
    });

    if (!sendRes.ok) {
      const body = await sendRes.text();
      console.error('[send-media/360dialog] Send falhou:', body);
      return { success: false, error: `Send falhou: ${sendRes.status}` };
    }

    const sendData = await sendRes.json();
    return { success: true, messageId: sendData.messages?.[0]?.id };
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

    const mimetype = file.type || 'application/octet-stream';
    const mediaType = getMediaType(mimetype);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Prefixar nome do operador em negrito no caption (visivel no WhatsApp)
    const nomeOperador = session.user.nome;
    const captionToSend = caption ? `*${nomeOperador}:*\n${caption}` : `*${nomeOperador}*`;

    // Enviar via provider correto
    let sendResult: { success: boolean; messageId?: string; error?: string };

    if (conversa.provider === '360dialog') {
      const to = destinatario.replace('@s.whatsapp.net', '').replace('@g.us', '');
      sendResult = await sendMediaVia360Dialog(to, mediaType, fileBuffer, file.name, mimetype, captionToSend);
    } else {
      sendResult = await sendMediaViaUAZAPI(destinatario, mediaType, fileBuffer, file.name, mimetype, captionToSend);
    }

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Falha ao enviar midia' }, { status: 502 });
    }

    // Salvar mensagem no banco
    const owner = CATEGORIA_OWNER[conversa.categoria] || '';
    const waMessageId = sendResult.messageId || `sent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conteudo = caption || `[${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Audio' : mediaType === 'video' ? 'Video' : 'Documento'}]`;

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
        mediaType,
        conteudo,
        mimetype,
        file.name,
        JSON.stringify({ sent_by: session.user.id, sent_by_name: session.user.nome }),
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
      data: { conversa_id: conversaId, mensagem, categoria: conversa.categoria },
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
