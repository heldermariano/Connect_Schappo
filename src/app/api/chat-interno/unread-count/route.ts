import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const userId = parseInt(session.user.id as string);

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
