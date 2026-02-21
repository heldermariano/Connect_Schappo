import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversaId: string }> },
) {
  const { conversaId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const before = searchParams.get('before'); // ID para paginacao cursor

  const id = parseInt(conversaId);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    let query: string;
    let values: unknown[];

    if (before) {
      query = `
        SELECT * FROM atd.mensagens
        WHERE conversa_id = $1 AND id < $2
        ORDER BY created_at DESC
        LIMIT $3
      `;
      values = [id, parseInt(before), limit];
    } else {
      query = `
        SELECT * FROM atd.mensagens
        WHERE conversa_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      values = [id, limit];
    }

    const result = await pool.query(query, values);

    // Retornar em ordem cronologica (mais antiga primeiro)
    const mensagens = result.rows.reverse();
    const hasMore = result.rows.length === limit;

    return NextResponse.json({ mensagens, hasMore });
  } catch (err) {
    console.error('[api/mensagens] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
