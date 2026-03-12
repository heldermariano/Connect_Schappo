import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import { queryLatin1 } from '@/lib/db-agenda';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = request.nextUrl;
  const medicoId = searchParams.get('medico');
  const mes = searchParams.get('mes'); // formato: 2026-03

  if (!medicoId || !mes) {
    return NextResponse.json({ error: 'medico e mes sao obrigatorios' }, { status: 400 });
  }

  // Calcular primeiro e ultimo dia do mes
  const [year, month] = mes.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'mes invalido (formato: YYYY-MM)' }, { status: 400 });
  }

  const primeiroDia = `${mes}-01`;
  const ultimoDia = new Date(year, month, 0).toISOString().split('T')[0]; // ultimo dia do mes

  try {
    const result = await queryLatin1(`
      SELECT DISTINCT dat_agenda::date as dia
      FROM arq_agendal
      WHERE id_medico = $1
        AND dat_agenda >= $2 AND dat_agenda <= $3
        AND cod_paciente IS NOT NULL
        AND (ind_status IS NULL OR ind_status NOT IN ('B'))
      ORDER BY dia
    `, [parseInt(medicoId), primeiroDia, ultimoDia]);

    const dias = result.rows.map(r => r.dia instanceof Date
      ? r.dia.toISOString().split('T')[0]
      : String(r.dia).split('T')[0]
    );

    return NextResponse.json({ dias });
  } catch (err) {
    console.error('[api/agenda/dias-atendimento] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
