import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const userId = auth.userId;
  const userName = auth.session.user.nome || 'Operador';

  try {
    const { destinatario_ids, conteudo } = await request.json();

    if (!Array.isArray(destinatario_ids) || destinatario_ids.length === 0) {
      return NextResponse.json({ error: 'destinatario_ids obrigatorio (array)' }, { status: 400 });
    }
    if (!conteudo || typeof conteudo !== 'string' || !conteudo.trim()) {
      return NextResponse.json({ error: 'conteudo obrigatorio' }, { status: 400 });
    }

    const texto = conteudo.trim();
    let enviados = 0;

    for (const destId of destinatario_ids) {
      if (destId === userId) continue;

      // Upsert chat 1:1 (mesma logica do POST /api/chat-interno)
      const p1 = Math.min(userId, destId);
      const p2 = Math.max(userId, destId);

      const chatResult = await pool.query(
        `INSERT INTO atd.chat_interno (participante1_id, participante2_id)
         VALUES ($1, $2)
         ON CONFLICT (LEAST(participante1_id, participante2_id), GREATEST(participante1_id, participante2_id))
         DO UPDATE SET participante1_id = atd.chat_interno.participante1_id
         RETURNING *`,
        [p1, p2],
      );

      const chat = chatResult.rows[0];
      if (!chat) continue;

      // Inserir mensagem
      const msgResult = await pool.query(
        `INSERT INTO atd.chat_interno_mensagens (chat_id, atendente_id, conteudo)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [chat.id, userId, texto],
      );

      const mensagem = msgResult.rows[0];
      mensagem.nome_remetente = userName;

      // Atualizar ultima mensagem do chat
      await pool.query(
        `UPDATE atd.chat_interno SET ultima_mensagem = LEFT($1, 200), ultima_msg_at = NOW() WHERE id = $2`,
        [texto, chat.id],
      );

      // Broadcast SSE para o destinatario
      sseManager.broadcast({
        type: 'chat_interno_mensagem',
        data: {
          chat_id: chat.id,
          mensagem,
          destinatario_id: destId,
        },
      });

      enviados++;
    }

    return NextResponse.json({ success: true, enviados });
  } catch (err) {
    console.error('[api/chat-interno/broadcast] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
