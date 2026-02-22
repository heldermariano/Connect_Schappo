import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

// Categorias permitidas por grupo de atendimento
const GRUPO_CATEGORIAS: Record<string, string[]> = {
  recepcao: ['recepcao', 'geral'],
  eeg: ['eeg'],
  todos: ['eeg', 'recepcao', 'geral'],
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const grupo = (session.user as { grupo?: string }).grupo || 'todos';
  const categoriasPermitidas = GRUPO_CATEGORIAS[grupo] || GRUPO_CATEGORIAS.todos;

  const params = request.nextUrl.searchParams;
  const categoria = params.get('categoria'); // 'eeg', 'recepcao', 'geral'
  const tipo = params.get('tipo'); // 'individual', 'grupo'
  const busca = params.get('busca'); // Busca por nome/telefone
  const limit = Math.min(parseInt(params.get('limit') || '50'), 100);
  const offset = parseInt(params.get('offset') || '0');

  const conditions: string[] = ['c.is_archived = FALSE'];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Filtro por grupo do atendente (server-side)
  if (grupo !== 'todos') {
    const placeholders = categoriasPermitidas.map(() => `$${paramIndex++}`);
    conditions.push(`c.categoria IN (${placeholders.join(', ')})`);
    values.push(...categoriasPermitidas);
  }

  if (categoria) {
    // Validar que a categoria solicitada esta dentro do escopo permitido
    if (!categoriasPermitidas.includes(categoria)) {
      return NextResponse.json({ conversas: [], total: 0, limit, offset });
    }
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
