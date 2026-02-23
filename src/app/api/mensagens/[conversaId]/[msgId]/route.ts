import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ conversaId: string; msgId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem excluir mensagens' }, { status: 403 });
  }

  const { conversaId, msgId } = await params;
  const cId = parseInt(conversaId, 10);
  const mId = parseInt(msgId, 10);
  if (isNaN(cId) || isNaN(mId)) {
    return NextResponse.json({ error: 'IDs invalidos' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      'DELETE FROM atd.mensagens WHERE id = $1 AND conversa_id = $2 RETURNING id',
      [mId, cId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Mensagem nao encontrada' }, { status: 404 });
    }

    // Broadcast SSE para frontend remover a mensagem
    sseManager.broadcast({
      type: 'mensagem_removida' as 'conversa_atualizada',
      data: { conversa_id: cId, mensagem_id: mId } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/mensagens/DELETE] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
