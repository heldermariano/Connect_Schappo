import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const atendenteId = parseInt(session.user.id as string);
  if (!atendenteId) {
    return NextResponse.json({ error: 'Atendente nao identificado' }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT * FROM atd.respostas_prontas WHERE atendente_id = $1 ORDER BY atalho`,
    [atendenteId],
  );

  return NextResponse.json({ respostas: result.rows });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const atendenteId = parseInt(session.user.id as string);
  if (!atendenteId) {
    return NextResponse.json({ error: 'Atendente nao identificado' }, { status: 401 });
  }

  const body = await request.json();
  const { atalho, conteudo } = body;

  if (!atalho?.trim() || !conteudo?.trim()) {
    return NextResponse.json({ error: 'Atalho e conteudo sao obrigatorios' }, { status: 400 });
  }

  if (atalho.trim().length > 50) {
    return NextResponse.json({ error: 'Atalho deve ter no maximo 50 caracteres' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO atd.respostas_prontas (atendente_id, atalho, conteudo)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [atendenteId, atalho.trim(), conteudo.trim()],
    );

    return NextResponse.json({ resposta: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Ja existe uma resposta com esse atalho' }, { status: 409 });
    }
    throw err;
  }
}
