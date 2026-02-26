import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const userId = parseInt(session.user.id as string);
  const { id: chatId } = await params;

  try {
    // Verificar participacao
    const chatCheck = await pool.query(
      'SELECT * FROM atd.chat_interno WHERE id = $1 AND (participante1_id = $2 OR participante2_id = $2)',
      [chatId, userId],
    );
    if (chatCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Chat nao encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const caption = (formData.get('caption') as string)?.trim() || null;
    const replyToId = formData.get('reply_to_id') ? parseInt(formData.get('reply_to_id') as string) : null;
    const isVoiceRecording = formData.get('voice_recording') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatorio' }, { status: 400 });
    }

    // Determinar tipo
    const mimetype = file.type || 'application/octet-stream';
    let tipo = 'document';
    if (isVoiceRecording) tipo = 'ptt';
    else if (mimetype.startsWith('image/')) tipo = 'image';
    else if (mimetype.startsWith('audio/')) tipo = 'audio';
    else if (mimetype.startsWith('video/')) tipo = 'video';

    // Salvar arquivo em /public/uploads/chat-interno/
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'chat-interno');
    await mkdir(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'bin';
    const filename = `${chatId}_${userId}_${timestamp}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const mediaUrl = `/uploads/chat-interno/${filename}`;

    const chat = chatCheck.rows[0];
    const destinatarioId = chat.participante1_id === userId ? chat.participante2_id : chat.participante1_id;

    // Inserir mensagem
    const msgResult = await pool.query(
      `INSERT INTO atd.chat_interno_mensagens (chat_id, atendente_id, conteudo, tipo, media_url, media_mimetype, media_filename, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [chatId, userId, caption, tipo, mediaUrl, mimetype, file.name, replyToId],
    );

    const mensagem = msgResult.rows[0];
    mensagem.nome_remetente = session.user.nome;

    // Atualizar chat
    const previewText = caption || (tipo === 'image' ? 'Imagem' : tipo === 'audio' || tipo === 'ptt' ? 'Audio' : tipo === 'video' ? 'Video' : 'Documento');
    await pool.query(
      `UPDATE atd.chat_interno SET ultima_mensagem = LEFT($1, 200), ultima_msg_at = NOW() WHERE id = $2`,
      [previewText, chatId],
    );

    // Broadcast SSE
    sseManager.broadcast({
      type: 'chat_interno_mensagem',
      data: {
        chat_id: parseInt(chatId as string),
        mensagem,
        destinatario_id: destinatarioId,
      },
    });

    return NextResponse.json({ mensagem });
  } catch (err) {
    console.error('[api/chat-interno/media] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
