import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { originate, isAMIConnected } from '@/lib/ami-listener';
import pool from '@/lib/db';

// POST: Iniciar chamada click-to-call
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const { destino } = await request.json();

    // Validar destino
    if (!destino || typeof destino !== 'string') {
      return NextResponse.json({ error: 'Destino invalido' }, { status: 400 });
    }

    // Limpar destino (remover caracteres nao numericos)
    const destinoLimpo = destino.replace(/\D/g, '');
    if (destinoLimpo.length < 8 || destinoLimpo.length > 15) {
      return NextResponse.json({ error: 'Numero de destino invalido' }, { status: 400 });
    }

    // Verificar se atendente tem ramal
    const ramal = session.user.ramal;
    if (!ramal) {
      return NextResponse.json({ error: 'Atendente sem ramal configurado' }, { status: 400 });
    }

    // Verificar se atendente esta disponivel
    const statusResult = await pool.query(
      `SELECT status_presenca FROM atd.atendentes WHERE id = $1`,
      [parseInt(session.user.id)],
    );
    const presenca = statusResult.rows[0]?.status_presenca;
    if (presenca && presenca !== 'disponivel') {
      return NextResponse.json({ error: `Status atual: ${presenca}. Mude para disponivel antes de ligar.` }, { status: 400 });
    }

    // Verificar AMI
    if (!isAMIConnected()) {
      return NextResponse.json({ error: 'AMI nao disponivel. Telefonia indisponivel no momento.' }, { status: 503 });
    }

    // Executar originate
    const result = await originate(ramal, destinoLimpo);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Falha ao iniciar chamada' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      actionId: result.actionId,
      ramal,
      destino: destinoLimpo,
    });
  } catch (err) {
    console.error('[API/calls/originate] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
