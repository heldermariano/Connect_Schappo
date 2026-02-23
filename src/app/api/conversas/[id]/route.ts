import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem excluir conversas' }, { status: 403 });
  }

  const { id } = await params;
  const conversaId = parseInt(id, 10);
  if (isNaN(conversaId)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  try {
    // Verificar se conversa existe
    const check = await pool.query('SELECT id FROM atd.conversas WHERE id = $1', [conversaId]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    // Deletar em cascata: mensagens primeiro, depois conversa
    await pool.query('DELETE FROM atd.mensagens WHERE conversa_id = $1', [conversaId]);
    await pool.query('DELETE FROM atd.conversas WHERE id = $1', [conversaId]);

    // Broadcast SSE para frontend remover a conversa
    sseManager.broadcast({
      type: 'conversa_removida' as 'conversa_atualizada',
      data: { conversa_id: conversaId } as unknown as { conversa_id: number; ultima_msg: string; nao_lida: number },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/conversas/DELETE] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
