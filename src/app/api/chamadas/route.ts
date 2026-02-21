import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origem = params.get('origem'); // 'whatsapp', 'telefone', 'whatsapp-tentativa'
  const status = params.get('status'); // 'ringing', 'answered', 'missed', etc.
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
  const offset = parseInt(params.get('offset') || '0');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (origem) {
    conditions.push(`ch.origem = $${paramIndex++}`);
    values.push(origem);
  }

  if (status) {
    conditions.push(`ch.status = $${paramIndex++}`);
    values.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM atd.chamadas ch ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT ch.*, a.nome AS atendente_nome
       FROM atd.chamadas ch
       LEFT JOIN atd.atendentes a ON a.id = ch.atendente_id
       ${whereClause}
       ORDER BY ch.inicio_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset],
    );

    return NextResponse.json({
      chamadas: result.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[api/chamadas] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
