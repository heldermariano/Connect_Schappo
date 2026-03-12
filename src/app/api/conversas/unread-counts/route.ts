import { NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import pool from '@/lib/db';

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { categoriasPermitidas } = auth;

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
