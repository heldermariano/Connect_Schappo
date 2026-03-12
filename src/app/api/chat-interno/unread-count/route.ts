import { NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import pool from '@/lib/db';

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const userId = auth.userId;

  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(sub.nao_lidas), 0)::int AS count
       FROM (
         SELECT (SELECT COUNT(*) FROM atd.chat_interno_mensagens m
                 WHERE m.chat_id = ci.id AND m.atendente_id != $1 AND m.lida = FALSE) AS nao_lidas
         FROM atd.chat_interno ci
         WHERE ci.participante1_id = $1 OR ci.participante2_id = $1
       ) sub`,
      [userId],
    );

    return NextResponse.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('[api/chat-interno/unread-count] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
