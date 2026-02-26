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

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  if (!userId) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  const body = await request.json();
  const { nome, telefone, cargo, setor } = body;

  if (!nome?.trim() || !telefone?.trim()) {
    return NextResponse.json({ error: 'Nome e telefone sao obrigatorios' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE atd.hub_usuarios
       SET nome = $1, telefone = $2, cargo = $3, setor = $4, updated_at = NOW()
       WHERE id = $5 AND ativo = TRUE
       RETURNING *`,
      [nome.trim(), telefone.trim(), cargo?.trim() || 'Técnico EEG', setor?.trim() || null, userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
    }

    return NextResponse.json({ usuario: result.rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Ja existe um usuario com esse telefone' }, { status: 409 });
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

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);
  if (!userId) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  // Soft delete
  const result = await pool.query(
    `UPDATE atd.hub_usuarios SET ativo = FALSE, updated_at = NOW()
     WHERE id = $1 AND ativo = TRUE
     RETURNING id`,
    [userId],
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
