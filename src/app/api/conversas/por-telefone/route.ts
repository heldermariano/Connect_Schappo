import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

/**
 * GET /api/conversas/por-telefone?telefone=X
 * Retorna todas as conversas individuais de um telefone (para o channel picker).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const telefone = request.nextUrl.searchParams.get('telefone');
  if (!telefone) {
    return NextResponse.json({ error: 'telefone e obrigatorio' }, { status: 400 });
  }

  const tel = telefone.replace(/\D/g, '');
  if (!tel) {
    return NextResponse.json({ error: 'telefone invalido' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT id, categoria, ultima_msg_at, is_archived
       FROM atd.conversas
       WHERE telefone = $1 AND tipo = 'individual'
       ORDER BY ultima_msg_at DESC NULLS LAST`,
      [tel],
    );

    return NextResponse.json({ conversas: result.rows });
  } catch (err) {
    console.error('[api/conversas/por-telefone] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
