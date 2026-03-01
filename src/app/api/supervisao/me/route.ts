import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { GRUPO_CHANNELS } from '@/lib/types';

// GET: Dados de inatividade do operador logado (leve, chamado a cada 30s)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const role = (session.user as { role?: string }).role || 'atendente';
    // Supervisores e admins nao passam pelo fluxo de inatividade
    if (role === 'admin' || role === 'supervisor') {
      return NextResponse.json({
        conversas_pendentes: 0,
        ultima_resposta_at: new Date().toISOString(),
        canal_mais_pendente: null,
        minutos_sem_resposta: 0,
      });
    }

    const grupo = (session.user as { grupo?: string }).grupo || 'todos';
    const allowedChannels = GRUPO_CHANNELS[grupo] || GRUPO_CHANNELS.todos;

    // Conversas individuais pendentes filtradas por grupo
    const pendentesResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        (
          SELECT c2.categoria
          FROM atd.conversas c2
          WHERE c2.nao_lida > 0
            AND c2.tipo = 'individual'
            AND c2.is_archived = false
            AND c2.categoria = ANY($1)
          GROUP BY c2.categoria
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS canal_mais_pendente
      FROM atd.conversas c
      WHERE c.nao_lida > 0
        AND c.tipo = 'individual'
        AND c.is_archived = false
        AND c.categoria = ANY($1)
    `, [allowedChannels]);

    // Ultima resposta from_me em conversas individuais do atendente
    const nome = (session.user as { nome?: string }).nome || '';
    const respostaResult = await pool.query(`
      SELECT MAX(m.created_at) AS ultima_resposta_at
      FROM atd.mensagens m
      JOIN atd.conversas c ON c.id = m.conversa_id
      WHERE m.from_me = true
        AND m.sender_name = $1
        AND c.tipo = 'individual'
        AND c.categoria = ANY($2)
    `, [nome, allowedChannels]);

    const pendentes = pendentesResult.rows[0]?.total || 0;
    const canalPendente = pendentesResult.rows[0]?.canal_mais_pendente || null;
    const ultimaResposta = respostaResult.rows[0]?.ultima_resposta_at || null;

    // Calcular minutos sem resposta
    let minutosSemResposta = 0;
    if (ultimaResposta) {
      const diff = Date.now() - new Date(ultimaResposta).getTime();
      minutosSemResposta = Math.floor(diff / 60000);
    } else {
      minutosSemResposta = 999; // Nunca respondeu
    }

    return NextResponse.json({
      conversas_pendentes: pendentes,
      ultima_resposta_at: ultimaResposta,
      canal_mais_pendente: canalPendente,
      minutos_sem_resposta: minutosSemResposta,
    });
  } catch (err) {
    console.error('[API/supervisao/me] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
