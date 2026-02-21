import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const categoria = params.get('categoria'); // 'eeg', 'recepcao', 'geral'
  const tipo = params.get('tipo'); // 'individual', 'grupo'
  const busca = params.get('busca'); // Busca por nome/telefone
  const limit = Math.min(parseInt(params.get('limit') || '50'), 100);
  const offset = parseInt(params.get('offset') || '0');

  const conditions: string[] = ['c.is_archived = FALSE'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (categoria) {
    conditions.push(`c.categoria = $${paramIndex++}`);
    values.push(categoria);
  }

  if (tipo) {
    conditions.push(`c.tipo = $${paramIndex++}`);
    values.push(tipo);
  }

  if (busca) {
    conditions.push(
      `(c.nome_contato ILIKE $${paramIndex} OR c.nome_grupo ILIKE $${paramIndex} OR c.telefone ILIKE $${paramIndex})`,
    );
    values.push(`%${busca}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM atd.conversas c ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT c.*, a.nome AS atendente_nome
       FROM atd.conversas c
       LEFT JOIN atd.atendentes a ON a.id = c.atendente_id
       ${whereClause}
       ORDER BY c.ultima_msg_at DESC NULLS LAST
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset],
    );

    return NextResponse.json({
      conversas: result.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[api/conversas] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
