import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const grupo = (session.user as { grupo?: string }).grupo || 'todos';
  const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;

  try {
    const placeholders = categoriasPermitidas.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `SELECT categoria, COUNT(*)::int AS count
       FROM atd.conversas
       WHERE nao_lida > 0
         AND is_archived = FALSE
         AND ultima_msg_from_me = FALSE
         AND categoria IN (${placeholders})
       GROUP BY categoria`,
      categoriasPermitidas,
    );

    const counts: Record<string, number> = {};
    for (const cat of categoriasPermitidas) {
      counts[cat] = 0;
    }
    for (const row of result.rows) {
      counts[row.categoria] = row.count;
    }

    return NextResponse.json({ counts });
  } catch (err) {
    console.error('[api/conversas/unread-counts] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
