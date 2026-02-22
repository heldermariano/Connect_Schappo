import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/contatos/add — Adicionar contato manualmente.
 * Cria conversa via atd.upsert_conversa().
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, telefone } = body as { nome?: string; telefone?: string };

    if (!nome || !telefone) {
      return NextResponse.json(
        { error: 'Nome e telefone sao obrigatorios' },
        { status: 400 },
      );
    }

    // Limpar telefone (so digitos)
    const phoneClean = telefone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
      return NextResponse.json(
        { error: 'Telefone invalido' },
        { status: 400 },
      );
    }

    // Formato wa_chatid
    const waChatid = `${phoneClean}@s.whatsapp.net`;

    // Upsert conversa
    const result = await pool.query(
      `SELECT atd.upsert_conversa($1, $2, $3, $4, $5, NULL, $6) AS id`,
      [waChatid, 'individual', 'geral', 'uazapi', nome, phoneClean],
    );

    return NextResponse.json({
      id: result.rows[0].id,
      nome,
      telefone: phoneClean,
    });
  } catch (err) {
    console.error('[api/contatos/add] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
