import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

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

    const { mensagem_id, emoji } = await request.json();
    if (!mensagem_id || !emoji) {
      return NextResponse.json({ error: 'mensagem_id e emoji obrigatorios' }, { status: 400 });
    }

    // Verificar mensagem pertence ao chat
    const msgCheck = await pool.query(
      'SELECT id, reacoes FROM atd.chat_interno_mensagens WHERE id = $1 AND chat_id = $2',
      [mensagem_id, chatId],
    );
    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    const currentReacoes: Array<{ emoji: string; atendente_id: number; nome: string }> = msgCheck.rows[0].reacoes || [];

    // Toggle: se ja reagiu com o mesmo emoji, remove; senao, adiciona
    const existingIdx = currentReacoes.findIndex((r) => r.atendente_id === userId && r.emoji === emoji);
    if (existingIdx >= 0) {
      currentReacoes.splice(existingIdx, 1);
    } else {
      // Remover reacao anterior do mesmo usuario (so permite 1 reacao por pessoa)
      const prevIdx = currentReacoes.findIndex((r) => r.atendente_id === userId);
      if (prevIdx >= 0) currentReacoes.splice(prevIdx, 1);
      currentReacoes.push({ emoji, atendente_id: userId, nome: session.user.nome });
    }

    // Atualizar no banco
    await pool.query(
      'UPDATE atd.chat_interno_mensagens SET reacoes = $1 WHERE id = $2',
      [JSON.stringify(currentReacoes), mensagem_id],
    );

    const chat = chatCheck.rows[0];
    const destinatarioId = chat.participante1_id === userId ? chat.participante2_id : chat.participante1_id;

    // Broadcast SSE
    sseManager.broadcast({
      type: 'chat_interno_reacao',
      data: {
        chat_id: parseInt(chatId as string),
        mensagem_id,
        reacoes: currentReacoes,
        destinatario_id: destinatarioId,
      },
    });

    return NextResponse.json({ reacoes: currentReacoes });
  } catch (err) {
    console.error('[api/chat-interno/react] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
