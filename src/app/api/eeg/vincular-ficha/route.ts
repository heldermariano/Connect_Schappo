import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function validateBotToken(request: NextRequest): boolean {
  const botToken = request.headers.get('x-bot-token');
  const secret = process.env.WEBHOOK_SECRET;
  return !!botToken && !!secret && botToken === secret;
}

export async function POST(request: NextRequest) {
  if (!validateBotToken(request)) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      eeg_exame_id,
      neuro_exam_id,
      caixa_codigo,
      tecnico_nome,
      paciente_nome,
      aparelho,
      is_continuo,
    } = body;

    if (!eeg_exame_id) {
      return NextResponse.json({ error: 'eeg_exame_id obrigatorio' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO atd.eeg_exame_ficha_vinculo
        (eeg_exame_id, neuro_exam_id, caixa_codigo, tecnico_nome, paciente_nome, aparelho, is_continuo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        eeg_exame_id,
        neuro_exam_id || null,
        caixa_codigo || null,
        tecnico_nome || null,
        paciente_nome || null,
        aparelho || null,
        is_continuo || false,
      ],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, message: 'Vinculo ja existente' });
    }

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error('[api/eeg/vincular-ficha] Erro:', err);
    return NextResponse.json({ error: 'Erro ao vincular ficha' }, { status: 500 });
  }
}

// PATCH para atualizar vinculo (ex: assumido por outro tecnico)
export async function PATCH(request: NextRequest) {
  if (!validateBotToken(request)) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, eeg_exame_id, status, assumido_por_nome } = body;

    if (!id && !eeg_exame_id) {
      return NextResponse.json({ error: 'id ou eeg_exame_id obrigatorio' }, { status: 400 });
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: (string | number | null)[] = [];
    let paramIdx = 1;

    if (status) {
      updates.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    if (assumido_por_nome) {
      updates.push(`assumido_por_nome = $${paramIdx}`);
      params.push(assumido_por_nome);
      paramIdx++;
      updates.push('assumido_em = NOW()');
    }

    // Filtro por id ou eeg_exame_id
    let whereClause: string;
    if (id) {
      whereClause = `id = $${paramIdx}`;
      params.push(id);
    } else {
      whereClause = `eeg_exame_id = $${paramIdx}`;
      params.push(eeg_exame_id);
    }

    const result = await pool.query(
      `UPDATE atd.eeg_exame_ficha_vinculo
       SET ${updates.join(', ')}
       WHERE ${whereClause}
       RETURNING id, status`,
      params,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Vinculo nao encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, vinculo: result.rows[0] });
  } catch (err) {
    console.error('[api/eeg/vincular-ficha] Erro PATCH:', err);
    return NextResponse.json({ error: 'Erro ao atualizar vinculo' }, { status: 500 });
  }
}
