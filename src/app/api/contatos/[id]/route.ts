import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

// GET /api/contatos/[id] — Busca contato por telefone (usado como identificador)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const telefone = decodeURIComponent(id);

  try {
    const result = await pool.query(
      `SELECT id, nome, telefone, email, avatar_url, chatwoot_id, notas, created_at, updated_at
       FROM atd.contatos WHERE telefone = $1`,
      [telefone],
    );

    if (result.rows.length === 0) {
      // Tentar buscar dados da conversa como fallback
      const conversaResult = await pool.query(
        `SELECT id AS conversa_id, nome_contato AS nome, telefone, avatar_url
         FROM atd.conversas WHERE telefone = $1 AND tipo = 'individual' LIMIT 1`,
        [telefone],
      );

      if (conversaResult.rows.length > 0) {
        return NextResponse.json({
          contato: {
            ...conversaResult.rows[0],
            email: null,
            notas: null,
            source: 'conversa',
          },
        });
      }

      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ contato: result.rows[0] });
  } catch (err) {
    console.error('[api/contatos/id] Erro GET:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// PUT /api/contatos/[id] — Atualiza ou cria contato por telefone
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const telefone = decodeURIComponent(id);

  try {
    const body = await request.json();
    const { nome, email, notas } = body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return NextResponse.json({ error: 'Nome e obrigatorio' }, { status: 400 });
    }

    // Upsert: cria se nao existe, atualiza se existe
    const result = await pool.query(
      `INSERT INTO atd.contatos (nome, telefone, email, notas, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (telefone) DO UPDATE SET
         nome = EXCLUDED.nome,
         email = EXCLUDED.email,
         notas = EXCLUDED.notas,
         updated_at = NOW()
       RETURNING *`,
      [nome.trim(), telefone, email?.trim() || null, notas?.trim() || null],
    );

    return NextResponse.json({ contato: result.rows[0] });
  } catch (err) {
    console.error('[api/contatos/id] Erro PUT:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
