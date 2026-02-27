import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';

// GET: Metricas de supervisao — apenas admin
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const connectedIds = sseManager.getConnectedAtendenteIds();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const result = await pool.query(`
      SELECT
        a.id,
        a.nome,
        a.status_presenca,
        a.grupo_atendimento,
        -- Conversas individuais pendentes (nao lida, nao arquivada)
        (
          SELECT COUNT(*)::int
          FROM atd.conversas c
          WHERE c.nao_lida > 0
            AND c.tipo = 'individual'
            AND c.is_archived = false
            AND (c.atendente_id = a.id OR c.atendente_id IS NULL)
        ) AS conversas_pendentes,
        -- Ultima resposta (from_me) em conversas individuais
        (
          SELECT MAX(m.created_at)
          FROM atd.mensagens m
          JOIN atd.conversas c ON c.id = m.conversa_id
          WHERE m.from_me = true
            AND c.tipo = 'individual'
            AND (c.atendente_id = a.id)
        ) AS ultima_resposta_at,
        -- Canal com mais pendencias
        (
          SELECT c.categoria
          FROM atd.conversas c
          WHERE c.nao_lida > 0
            AND c.tipo = 'individual'
            AND c.is_archived = false
            AND (c.atendente_id = a.id OR c.atendente_id IS NULL)
          GROUP BY c.categoria
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS canal_mais_pendente,
        -- Pausas hoje
        (
          SELECT COUNT(*)::int
          FROM atd.atendente_pausas p
          WHERE p.atendente_id = a.id
            AND p.inicio_at >= $1
        ) AS pausas_hoje,
        -- Duracao total de pausas hoje (minutos)
        (
          SELECT COALESCE(SUM(
            EXTRACT(EPOCH FROM (COALESCE(p.fim_at, NOW()) - p.inicio_at))
          )::int / 60, 0)
          FROM atd.atendente_pausas p
          WHERE p.atendente_id = a.id
            AND p.inicio_at >= $1
        ) AS duracao_pausas_min
      FROM atd.atendentes a
      WHERE a.ativo = true
      ORDER BY a.nome
    `, [hoje.toISOString()]);

    const atendentes = result.rows.map((a) => {
      // Cross-check com SSE: se nao esta conectado, status real eh offline
      const realStatus = (a.status_presenca !== 'offline' && !connectedIds.has(a.id))
        ? 'offline'
        : a.status_presenca;

      return {
        id: a.id,
        nome: a.nome,
        status: realStatus,
        grupo: a.grupo_atendimento,
        conversas_pendentes: a.conversas_pendentes,
        ultima_resposta_at: a.ultima_resposta_at,
        canal_mais_pendente: a.canal_mais_pendente,
        pausas_hoje: a.pausas_hoje,
        duracao_pausas_min: a.duracao_pausas_min,
      };
    });

    return NextResponse.json({ atendentes });
  } catch (err) {
    console.error('[API/supervisao] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
