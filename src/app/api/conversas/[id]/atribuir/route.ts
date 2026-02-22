import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

// PATCH: Atribuir atendente a uma conversa
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
    const { atendente_id } = await request.json();

    // atendente_id null = desatribuir
    if (atendente_id !== null && atendente_id !== undefined) {
      // Verificar se atendente existe e esta ativo
      const atendenteResult = await pool.query(
        `SELECT id, nome FROM atd.atendentes WHERE id = $1 AND ativo = true`,
        [atendente_id],
      );
      if (atendenteResult.rows.length === 0) {
        return NextResponse.json({ error: 'Atendente nao encontrado ou inativo' }, { status: 404 });
      }
    }

    const result = await pool.query(
      `UPDATE atd.conversas SET atendente_id = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, ultima_mensagem, nao_lida`,
      [atendente_id || null, conversaId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const conversa = result.rows[0];

    // Emitir SSE
    sseManager.broadcast({
      type: 'conversa_atualizada',
      data: {
        conversa_id: conversaId,
        ultima_msg: conversa.ultima_mensagem || '',
        nao_lida: conversa.nao_lida,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/conversas/atribuir] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
