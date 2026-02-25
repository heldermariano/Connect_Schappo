import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

export async function GET(
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
    // Verificar que o usuario participa do chat
    const chatCheck = await pool.query(
      'SELECT id FROM atd.chat_interno WHERE id = $1 AND (participante1_id = $2 OR participante2_id = $2)',
      [chatId, userId],
    );
    if (chatCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Chat nao encontrado' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before'); // cursor para paginacao

    let query = `SELECT m.*, a.nome AS nome_remetente
       FROM atd.chat_interno_mensagens m
       JOIN atd.atendentes a ON a.id = m.atendente_id
       WHERE m.chat_id = $1`;
    const values: unknown[] = [chatId];

    if (before) {
      query += ` AND m.id < $2 ORDER BY m.created_at DESC LIMIT $3`;
      values.push(parseInt(before), limit);
    } else {
      query += ` ORDER BY m.created_at DESC LIMIT $2`;
      values.push(limit);
    }

    const result = await pool.query(query, values);

    // Marcar como lidas as mensagens do outro participante
    await pool.query(
      `UPDATE atd.chat_interno_mensagens SET lida = TRUE
       WHERE chat_id = $1 AND atendente_id != $2 AND lida = FALSE`,
      [chatId, userId],
    );

    return NextResponse.json({
      mensagens: result.rows.reverse(),
      hasMore: result.rows.length === limit,
    });
  } catch (err) {
    console.error('[api/chat-interno/mensagens] Erro GET:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

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
    // Verificar participacao e buscar outro participante
    const chatCheck = await pool.query(
      'SELECT * FROM atd.chat_interno WHERE id = $1 AND (participante1_id = $2 OR participante2_id = $2)',
      [chatId, userId],
    );
    if (chatCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Chat nao encontrado' }, { status: 404 });
    }

    const { conteudo } = await request.json();
    if (!conteudo || typeof conteudo !== 'string' || !conteudo.trim()) {
      return NextResponse.json({ error: 'conteudo obrigatorio' }, { status: 400 });
    }

    const chat = chatCheck.rows[0];
    const destinatarioId = chat.participante1_id === userId ? chat.participante2_id : chat.participante1_id;

    // Inserir mensagem
    const msgResult = await pool.query(
      `INSERT INTO atd.chat_interno_mensagens (chat_id, atendente_id, conteudo)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [chatId, userId, conteudo.trim()],
    );

    const mensagem = msgResult.rows[0];
    mensagem.nome_remetente = session.user.nome;

    // Atualizar ultima mensagem do chat
    await pool.query(
      `UPDATE atd.chat_interno SET ultima_mensagem = LEFT($1, 200), ultima_msg_at = NOW() WHERE id = $2`,
      [conteudo.trim(), chatId],
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
    console.error('[api/chat-interno/mensagens] Erro POST:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
