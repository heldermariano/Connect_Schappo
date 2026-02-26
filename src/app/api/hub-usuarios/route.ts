import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT * FROM atd.hub_usuarios WHERE ativo = TRUE ORDER BY nome`,
  );

  return NextResponse.json({ usuarios: result.rows });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const body = await request.json();
  const { nome, telefone, cargo, setor } = body;

  if (!nome?.trim() || !telefone?.trim()) {
    return NextResponse.json({ error: 'Nome e telefone sao obrigatorios' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO atd.hub_usuarios (nome, telefone, cargo, setor)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nome.trim(), telefone.trim(), cargo?.trim() || 'Técnico EEG', setor?.trim() || null],
    );

    return NextResponse.json({ usuario: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Ja existe um usuario com esse telefone' }, { status: 409 });
    }
    throw err;
  }
}
