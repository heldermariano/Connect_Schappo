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

    // Metricas globais do dia (queries em paralelo)
    const [metConversasHoje, metFinalizadas, metPendentes, metRanking] = await Promise.all([
      // Conversas com atividade hoje
      pool.query(`
        SELECT COUNT(DISTINCT c.id)::int AS total
        FROM atd.conversas c
        JOIN atd.mensagens m ON m.conversa_id = c.id
        WHERE m.created_at >= $1 AND c.tipo = 'individual'
      `, [hoje.toISOString()]),

      // Finalizadas hoje
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM atd.conversas c
        WHERE c.is_archived = true AND c.updated_at >= $1 AND c.tipo = 'individual'
      `, [hoje.toISOString()]),

      // Pendentes agora (nao lida, nao arquivada, ultima msg do cliente)
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM atd.conversas c
        WHERE c.nao_lida > 0 AND c.is_archived = false AND c.ultima_msg_from_me = false AND c.tipo = 'individual'
      `),

      // Ranking por operador: conversas atendidas hoje + tempo medio resposta
      // Tempo conta apenas a partir de quando o operador ficou disponivel (login/retorno de pausa)
      pool.query(`
        WITH respostas AS (
          SELECT
            c.atendente_id,
            m.conversa_id,
            m.created_at AS resposta_at,
            (
              SELECT MAX(m2.created_at)
              FROM atd.mensagens m2
              WHERE m2.conversa_id = m.conversa_id
                AND m2.from_me = false
                AND m2.created_at < m.created_at
            ) AS pergunta_at,
            a.disponivel_desde
          FROM atd.mensagens m
          JOIN atd.conversas c ON c.id = m.conversa_id
          JOIN atd.atendentes a ON a.id = c.atendente_id
          WHERE m.from_me = true
            AND m.created_at >= $1
            AND c.tipo = 'individual'
            AND c.atendente_id IS NOT NULL
        )
        SELECT
          atendente_id,
          COUNT(DISTINCT conversa_id)::int AS conversas_atendidas,
          COALESCE(
            AVG(
              CASE WHEN pergunta_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (
                  resposta_at - GREATEST(pergunta_at, COALESCE(disponivel_desde, pergunta_at))
                )) / 60
              END
            )::int,
            0
          ) AS tempo_medio_min
        FROM respostas
        WHERE pergunta_at IS NOT NULL
        GROUP BY atendente_id
      `, [hoje.toISOString()]),
    ]);

    const metricas = {
      conversas_hoje: metConversasHoje.rows[0]?.total || 0,
      finalizadas_hoje: metFinalizadas.rows[0]?.total || 0,
      pendentes_agora: metPendentes.rows[0]?.total || 0,
      tempo_medio_global: 0 as number,
    };

    // Ranking indexado por atendente_id
    const rankingMap = new Map<number, { conversas_atendidas: number; tempo_medio_min: number }>();
    let totalTempo = 0;
    let countComTempo = 0;
    for (const r of metRanking.rows) {
      rankingMap.set(r.atendente_id, {
        conversas_atendidas: r.conversas_atendidas,
        tempo_medio_min: r.tempo_medio_min,
      });
      if (r.tempo_medio_min > 0) {
        totalTempo += r.tempo_medio_min * r.conversas_atendidas;
        countComTempo += r.conversas_atendidas;
      }
    }
    metricas.tempo_medio_global = countComTempo > 0 ? Math.round(totalTempo / countComTempo) : 0;

    // Enriquecer atendentes com ranking
    const atendentesComRanking = atendentes.map((a) => {
      const rank = rankingMap.get(a.id);
      return {
        ...a,
        conversas_atendidas: rank?.conversas_atendidas || 0,
        tempo_medio_min: rank?.tempo_medio_min || 0,
      };
    });

    return NextResponse.json({ atendentes: atendentesComRanking, metricas });
  } catch (err) {
    console.error('[API/supervisao] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
