import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/contatos — Lista contatos agregados de conversas individuais + participantes de grupo + tabela contatos.
 * Faz LEFT JOIN com atd.contatos para enriquecer com email, chatwoot_id, notas.
 * Inclui contatos da tabela dedicada que nao tem conversa correspondente (UNION).
 * Query params: busca (nome/telefone/email)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const busca = searchParams.get('busca')?.trim() || '';

  try {
    let query = `
      WITH contatos_conversas AS (
        SELECT
          c.id AS conversa_id,
          COALESCE(ct.nome, c.nome_contato) AS nome,
          c.telefone,
          ct.email,
          COALESCE(ct.avatar_url, c.avatar_url) AS avatar_url,
          'individual' AS tipo,
          c.categoria,
          c.ultima_msg_at,
          ct.chatwoot_id,
          ct.notas
        FROM atd.conversas c
        LEFT JOIN atd.contatos ct ON ct.telefone = c.telefone AND ct.telefone IS NOT NULL AND ct.telefone != ''
        WHERE c.tipo = 'individual' AND c.telefone IS NOT NULL AND c.telefone != ''
      ),
      contatos_participantes AS (
        SELECT
          NULL::integer AS conversa_id,
          COALESCE(ct.nome, p.nome_salvo, p.nome_whatsapp) AS nome,
          p.wa_phone AS telefone,
          ct.email,
          COALESCE(ct.avatar_url, p.avatar_url) AS avatar_url,
          'participante' AS tipo,
          NULL AS categoria,
          NULL::timestamptz AS ultima_msg_at,
          ct.chatwoot_id,
          ct.notas
        FROM atd.participantes_grupo p
        LEFT JOIN atd.contatos ct ON ct.telefone = p.wa_phone AND ct.telefone IS NOT NULL AND ct.telefone != ''
        WHERE COALESCE(p.nome_salvo, p.nome_whatsapp) IS NOT NULL
      ),
      contatos_dedicados AS (
        SELECT
          NULL::integer AS conversa_id,
          ct.nome,
          ct.telefone,
          ct.email,
          ct.avatar_url,
          'contato' AS tipo,
          NULL AS categoria,
          NULL::timestamptz AS ultima_msg_at,
          ct.chatwoot_id,
          ct.notas
        FROM atd.contatos ct
        WHERE ct.telefone IS NOT NULL AND ct.telefone != ''
          AND NOT EXISTS (
            SELECT 1 FROM atd.conversas c WHERE c.telefone = ct.telefone AND c.tipo = 'individual'
          )
          AND NOT EXISTS (
            SELECT 1 FROM atd.participantes_grupo p WHERE p.wa_phone = ct.telefone
          )
      ),
      todos AS (
        SELECT * FROM contatos_conversas
        UNION ALL
        SELECT * FROM contatos_participantes
        UNION ALL
        SELECT * FROM contatos_dedicados
      ),
      dedup AS (
        SELECT DISTINCT ON (telefone)
          conversa_id,
          COALESCE(nome, telefone) AS nome,
          telefone,
          email,
          avatar_url,
          tipo,
          categoria,
          ultima_msg_at,
          chatwoot_id,
          notas
        FROM todos
        ORDER BY telefone, ultima_msg_at DESC NULLS LAST
      )
      SELECT * FROM dedup
    `;

    const values: string[] = [];

    if (busca) {
      query += ` WHERE nome ILIKE $1 OR telefone ILIKE $1 OR email ILIKE $1`;
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
