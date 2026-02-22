import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/contatos — Lista contatos agregados de conversas individuais + participantes de grupo.
 * Deduplica por telefone, retorna com avatar, nome, telefone, categoria, ultima_msg_at.
 * Query params: busca (nome/telefone)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const busca = searchParams.get('busca')?.trim() || '';

  try {
    // Agrega contatos de conversas individuais + participantes de grupo
    // Prioriza dados de conversas (nome_contato, avatar_url) e complementa com participantes
    let query = `
      WITH contatos_conversas AS (
        SELECT
          c.id AS conversa_id,
          c.nome_contato AS nome,
          c.telefone,
          c.avatar_url,
          'individual' AS tipo,
          c.categoria,
          c.ultima_msg_at
        FROM atd.conversas c
        WHERE c.tipo = 'individual' AND c.telefone IS NOT NULL AND c.telefone != ''
      ),
      contatos_participantes AS (
        SELECT
          NULL::integer AS conversa_id,
          COALESCE(p.nome_salvo, p.nome_whatsapp) AS nome,
          p.wa_phone AS telefone,
          p.avatar_url,
          'participante' AS tipo,
          NULL AS categoria,
          NULL::timestamptz AS ultima_msg_at
        FROM atd.participantes_grupo p
        WHERE COALESCE(p.nome_salvo, p.nome_whatsapp) IS NOT NULL
      ),
      todos AS (
        SELECT * FROM contatos_conversas
        UNION ALL
        SELECT * FROM contatos_participantes
      ),
      dedup AS (
        SELECT DISTINCT ON (telefone)
          conversa_id,
          COALESCE(nome, telefone) AS nome,
          telefone,
          avatar_url,
          tipo,
          categoria,
          ultima_msg_at
        FROM todos
        ORDER BY telefone, ultima_msg_at DESC NULLS LAST
      )
      SELECT * FROM dedup
    `;

    const values: string[] = [];

    if (busca) {
      query += ` WHERE nome ILIKE $1 OR telefone ILIKE $1`;
      values.push(`%${busca}%`);
    }

    query += ` ORDER BY nome ASC LIMIT 500`;

    const result = await pool.query(query, values);

    return NextResponse.json({
      contatos: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    console.error('[api/contatos] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
