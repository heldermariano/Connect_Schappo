import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import pool from '@/lib/db';

// GET: listar templates (padrao + do operador logado)
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const atendenteId = auth.userId;

  try {
    const result = await pool.query(
      `SELECT id, nome, conteudo, padrao, atendente_id, created_at, updated_at
       FROM atd.template_confirmacao
       WHERE padrao = TRUE OR atendente_id = $1
       ORDER BY padrao DESC, nome ASC`,
      [atendenteId]
    );

    return NextResponse.json({ templates: result.rows });
  } catch (err) {
    console.error('[api/agenda/templates] Erro GET:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST: criar template
export async function POST(request: NextRequest) {
  const authPost = await requireAuth();
  if (!isAuthed(authPost)) return authPost;

  try {
    const { nome, conteudo } = await request.json();

    if (!nome || !conteudo) {
      return NextResponse.json({ error: 'nome e conteudo sao obrigatorios' }, { status: 400 });
    }

    const atendenteId = authPost.userId;

    const result = await pool.query(
      `INSERT INTO atd.template_confirmacao (nome, conteudo, atendente_id)
       VALUES ($1, $2, $3)
       RETURNING id, nome, conteudo, padrao, atendente_id, created_at, updated_at`,
      [nome.trim(), conteudo.trim(), atendenteId]
    );

    return NextResponse.json({ template: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[api/agenda/templates] Erro POST:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
