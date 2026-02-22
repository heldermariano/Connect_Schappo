import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

// PATCH: Marcar conversa como lida (zerar nao_lida)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const conversaId = parseInt(id);
  if (isNaN(conversaId)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE atd.conversas SET nao_lida = 0, updated_at = NOW()
       WHERE id = $1 RETURNING id, ultima_mensagem`,
      [conversaId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    // Emitir SSE para atualizar outros clientes
    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: conversaId,
        ultima_msg: result.rows[0].ultima_mensagem || '',
        nao_lida: 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/conversas/read] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
