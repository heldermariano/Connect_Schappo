import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { sseManager } from '@/lib/sse-manager';
import { pauseQueue } from '@/lib/ami-listener';

// PATCH: Atualizar status de presenca do atendente logado
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { status } = await request.json();

    const validStatuses = ['disponivel', 'pausa', 'almoco', 'cafe', 'lanche', 'offline'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status invalido' }, { status: 400 });
    }

    const atendenteId = parseInt(session.user.id);

    // Buscar status atual antes de atualizar
    const currentResult = await pool.query(
      `SELECT status_presenca FROM atd.atendentes WHERE id = $1`,
      [atendenteId],
    );
    const currentStatus = currentResult.rows[0]?.status_presenca;

    // Atualizar no banco
    await pool.query(
      `UPDATE atd.atendentes SET status_presenca = $1, updated_at = NOW() WHERE id = $2`,
      [status, atendenteId],
    );

    // Tracking de pausas (pausa, almoco, cafe, lanche)
    const pauseStatuses = ['pausa', 'almoco', 'cafe', 'lanche'];
    const isPause = pauseStatuses.includes(status);
    const wasPause = pauseStatuses.includes(currentStatus) || currentStatus === 'ausente';

    if (isPause) {
      // Fechar pausa anterior aberta (se houver) e abrir nova
      await pool.query(
        `UPDATE atd.atendente_pausas SET fim_at = NOW() WHERE atendente_id = $1 AND fim_at IS NULL`,
        [atendenteId],
      );
      await pool.query(
        `INSERT INTO atd.atendente_pausas (atendente_id, tipo) VALUES ($1, $2)`,
        [atendenteId, status],
      );
    } else if ((status === 'disponivel' || status === 'offline') && wasPause) {
      // Fechar pausa aberta
      await pool.query(
        `UPDATE atd.atendente_pausas SET fim_at = NOW() WHERE atendente_id = $1 AND fim_at IS NULL`,
        [atendenteId],
      );
    }

    // Se tem ramal, enviar QueuePause ao AMI
    if (session.user.ramal) {
      const paused = status !== 'disponivel';
      const reason = isPause ? status : '';
      pauseQueue(session.user.ramal, paused, reason);
    }

    // Emitir SSE para todos os clientes
    sseManager.broadcast({
      type: 'atendente_status',
      data: {
        atendente_id: atendenteId,
        nome: session.user.nome,
        status,
      },
    });

    return NextResponse.json({ status: 'ok', presenca: status });
  } catch (err) {
    console.error('[API/atendentes/status] Erro no PATCH:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET: Retorna status de todos os atendentes ativos
// Cross-check com conexoes SSE para corrigir status de quem nao tem conexao ativa
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT id, nome, ramal, status_presenca, ultimo_acesso
       FROM atd.atendentes
       WHERE ativo = true
       ORDER BY nome`,
    );

    // Cross-check: se atendente nao tem conexao SSE ativa, forcar offline
    const connectedIds = sseManager.getConnectedAtendenteIds();
    const atendentes = result.rows.map((a) => {
      if (a.status_presenca !== 'offline' && !connectedIds.has(a.id)) {
        // Correcao lazy: atualizar banco em background
        pool.query(
          `UPDATE atd.atendentes SET status_presenca = 'offline', updated_at = NOW() WHERE id = $1 AND status_presenca != 'offline'`,
          [a.id],
        ).catch(() => {});
        return { ...a, status_presenca: 'offline' };
      }
      return a;
    });

    return NextResponse.json({ atendentes });
  } catch (err) {
    console.error('[API/atendentes/status] Erro no GET:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
