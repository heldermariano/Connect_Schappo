import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryLatin1 } from '@/lib/db-agenda';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  try {
    const result = await queryLatin1(
      `SELECT id_medico,
              nom_medico::bytea as nom_medico,
              nom_guerra::bytea as nom_guerra,
              num_crm
       FROM arq_medico
       WHERE ind_status = 'Ativo'
         AND (ind_agenda_suspensa IS NULL OR ind_agenda_suspensa != 'S')
       ORDER BY nom_guerra, nom_medico`,
      [],
      ['nom_medico', 'nom_guerra']
    );

    return NextResponse.json({ medicos: result.rows });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[api/agenda/medicos] Erro:', errMsg, err);
    return NextResponse.json({ error: `Erro ao buscar medicos: ${errMsg}` }, { status: 500 });
  }
}
