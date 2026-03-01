import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chave: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { chave } = await params;
  const chaveInt = parseInt(chave);
  if (isNaN(chaveInt)) {
    return NextResponse.json({ error: 'chave invalida' }, { status: 400 });
  }

  try {
    const { status } = await request.json();

    const statusValidos = ['enviado', 'confirmado', 'desmarcou', 'sem_resposta'];
    if (!status || !statusValidos.includes(status)) {
      return NextResponse.json({ error: `status invalido. Valores aceitos: ${statusValidos.join(', ')}` }, { status: 400 });
    }

    const atendenteId = parseInt(session.user.id as string);

    const result = await pool.query(
      `UPDATE atd.confirmacao_agendamento
       SET status = $1,
           respondido_at = CASE WHEN $1 IN ('confirmado', 'desmarcou') THEN NOW() ELSE respondido_at END,
           atualizado_por = $2
       WHERE chave_agenda = $3
       RETURNING *`,
      [status, atendenteId, chaveInt]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Registro de confirmacao nao encontrado' }, { status: 404 });
    }

    return NextResponse.json({ confirmacao: result.rows[0] });
  } catch (err) {
    console.error('[api/agenda/status] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
