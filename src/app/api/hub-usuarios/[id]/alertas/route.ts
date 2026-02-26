import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const tecnicoId = parseInt(id);
  if (!tecnicoId) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  const [alertasResult, statsResult] = await Promise.all([
    pool.query(
      `SELECT * FROM atd.eeg_alertas_ficha
       WHERE tecnico_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [tecnicoId],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE corrigido = FALSE)::int AS pendentes,
         COUNT(*) FILTER (WHERE corrigido = TRUE)::int AS corrigidos
       FROM atd.eeg_alertas_ficha
       WHERE tecnico_id = $1`,
      [tecnicoId],
    ),
  ]);

  return NextResponse.json({
    alertas: alertasResult.rows,
    stats: statsResult.rows[0] || { total: 0, pendentes: 0, corrigidos: 0 },
  });
}
