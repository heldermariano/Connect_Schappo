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

    const validStatuses = ['disponivel', 'pausa', 'ausente', 'offline'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status invalido' }, { status: 400 });
    }

    const atendenteId = parseInt(session.user.id);

    // Atualizar no banco
    await pool.query(
      `UPDATE atd.atendentes SET status_presenca = $1, updated_at = NOW() WHERE id = $2`,
      [status, atendenteId],
    );

    // Se tem ramal, enviar QueuePause ao AMI
    if (session.user.ramal) {
      const paused = status !== 'disponivel';
      const reason = status === 'pausa' ? 'pausa' : status === 'ausente' ? 'ausente' : '';
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

    return NextResponse.json({ atendentes: result.rows });
  } catch (err) {
    console.error('[API/atendentes/status] Erro no GET:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
