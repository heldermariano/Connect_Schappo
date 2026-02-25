import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const atendenteId = parseInt(session.user.id as string);
  if (!atendenteId) {
    return NextResponse.json({ error: 'Atendente nao identificado' }, { status: 401 });
  }

  const { id } = await params;
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
      `UPDATE atd.respostas_prontas
       SET atalho = $1, conteudo = $2, updated_at = NOW()
       WHERE id = $3 AND atendente_id = $4
       RETURNING *`,
      [atalho.trim(), conteudo.trim(), parseInt(id, 10), atendenteId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Resposta nao encontrada' }, { status: 404 });
    }

    return NextResponse.json({ resposta: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Ja existe uma resposta com esse atalho' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const atendenteId = parseInt(session.user.id as string);
  if (!atendenteId) {
    return NextResponse.json({ error: 'Atendente nao identificado' }, { status: 401 });
  }

  const { id } = await params;

  const result = await pool.query(
    `DELETE FROM atd.respostas_prontas WHERE id = $1 AND atendente_id = $2`,
    [parseInt(id, 10), atendenteId],
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Resposta nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
