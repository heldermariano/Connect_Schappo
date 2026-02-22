import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/contatos/add — Adicionar contato manualmente.
 * Cria conversa via atd.upsert_conversa() e insere/atualiza em atd.contatos.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, telefone, email } = body as { nome?: string; telefone?: string; email?: string };

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

    // Inserir/atualizar na tabela dedicada de contatos
    const emailClean = email?.trim() || null;
    await pool.query(
      `INSERT INTO atd.contatos (nome, telefone, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (telefone) WHERE telefone IS NOT NULL AND telefone != ''
       DO UPDATE SET
         nome = COALESCE(EXCLUDED.nome, atd.contatos.nome),
         email = COALESCE(EXCLUDED.email, atd.contatos.email),
         updated_at = NOW()`,
      [nome, phoneClean, emailClean],
    );

    return NextResponse.json({
      id: result.rows[0].id,
      nome,
      telefone: phoneClean,
      email: emailClean,
    });
  } catch (err) {
    console.error('[api/contatos/add] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
