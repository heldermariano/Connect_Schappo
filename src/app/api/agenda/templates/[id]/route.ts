import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import pool from '@/lib/db';

// PUT: editar template (apenas do proprio operador, nao padrao)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { id } = await params;
  const templateId = parseInt(id);
  const atendenteId = auth.userId;

  try {
    const { nome, conteudo } = await request.json();

    if (!nome || !conteudo) {
      return NextResponse.json({ error: 'nome e conteudo sao obrigatorios' }, { status: 400 });
    }

    // Verificar ownership (nao pode editar templates padrao nem de outros)
    const check = await pool.query(
      `SELECT id, padrao, atendente_id FROM atd.template_confirmacao WHERE id = $1`,
      [templateId]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 404 });
    }

    if (check.rows[0].padrao) {
      return NextResponse.json({ error: 'Nao pode editar template padrao' }, { status: 403 });
    }

    if (check.rows[0].atendente_id !== atendenteId) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
    }

    const result = await pool.query(
      `UPDATE atd.template_confirmacao SET nome = $1, conteudo = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, nome, conteudo, padrao, atendente_id, created_at, updated_at`,
      [nome.trim(), conteudo.trim(), templateId]
    );

    return NextResponse.json({ template: result.rows[0] });
  } catch (err) {
    console.error('[api/agenda/templates/[id]] Erro PUT:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE: excluir template (apenas do proprio operador, nao padrao)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authDel = await requireAuth();
  if (!isAuthed(authDel)) return authDel;

  const { id } = await params;
  const templateId = parseInt(id);
  const atendenteId = authDel.userId;

  try {
    const check = await pool.query(
      `SELECT id, padrao, atendente_id FROM atd.template_confirmacao WHERE id = $1`,
      [templateId]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 404 });
    }

    if (check.rows[0].padrao) {
      return NextResponse.json({ error: 'Nao pode excluir template padrao' }, { status: 403 });
    }

    if (check.rows[0].atendente_id !== atendenteId) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
    }

    await pool.query(`DELETE FROM atd.template_confirmacao WHERE id = $1`, [templateId]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/agenda/templates/[id]] Erro DELETE:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
