import { NextRequest, NextResponse } from 'next/server';
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
    // Buscar chats do usuario com info do outro participante e contagem nao lidas
    const result = await pool.query(
      `SELECT ci.*,
              CASE WHEN ci.participante1_id = $1 THEN a2.nome ELSE a1.nome END AS outro_nome,
              CASE WHEN ci.participante1_id = $1 THEN a2.status_presenca ELSE a1.status_presenca END AS outro_status,
              CASE WHEN ci.participante1_id = $1 THEN ci.participante2_id ELSE ci.participante1_id END AS outro_id,
              (SELECT COUNT(*) FROM atd.chat_interno_mensagens m
               WHERE m.chat_id = ci.id AND m.atendente_id != $1 AND m.lida = FALSE) AS nao_lidas
       FROM atd.chat_interno ci
       JOIN atd.atendentes a1 ON a1.id = ci.participante1_id
       JOIN atd.atendentes a2 ON a2.id = ci.participante2_id
       WHERE ci.participante1_id = $1 OR ci.participante2_id = $1
       ORDER BY ci.ultima_msg_at DESC NULLS LAST`,
      [userId],
    );

    return NextResponse.json({ chats: result.rows });
  } catch (err) {
    console.error('[api/chat-interno] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const userId = parseInt(session.user.id as string);

  try {
    const { destinatario_id } = await request.json();

    if (!destinatario_id || destinatario_id === userId) {
      return NextResponse.json({ error: 'destinatario_id invalido' }, { status: 400 });
    }

    // Verificar se destinatario existe
    const destCheck = await pool.query('SELECT id FROM atd.atendentes WHERE id = $1 AND ativo = TRUE', [destinatario_id]);
    if (destCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Destinatario nao encontrado' }, { status: 404 });
    }

    // Buscar ou criar chat (usando LEAST/GREATEST para evitar duplicata)
    const p1 = Math.min(userId, destinatario_id);
    const p2 = Math.max(userId, destinatario_id);

    const result = await pool.query(
      `INSERT INTO atd.chat_interno (participante1_id, participante2_id)
       VALUES ($1, $2)
       ON CONFLICT (LEAST(participante1_id, participante2_id), GREATEST(participante1_id, participante2_id))
       DO UPDATE SET participante1_id = atd.chat_interno.participante1_id
       RETURNING *`,
      [p1, p2],
    );

    const chat = result.rows[0];

    // Buscar nome do outro participante
    const outroId = chat.participante1_id === userId ? chat.participante2_id : chat.participante1_id;
    const outroResult = await pool.query('SELECT nome, status_presenca FROM atd.atendentes WHERE id = $1', [outroId]);
    chat.outro_nome = outroResult.rows[0]?.nome;
    chat.outro_status = outroResult.rows[0]?.status_presenca;
    chat.nao_lidas = 0;

    return NextResponse.json({ chat });
  } catch (err) {
    console.error('[api/chat-interno] Erro ao criar chat:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
