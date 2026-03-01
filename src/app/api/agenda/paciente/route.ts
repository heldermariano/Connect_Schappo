import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { queryLatin1 } from '@/lib/db-agenda';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const telefone = request.nextUrl.searchParams.get('telefone');
  if (!telefone) {
    return NextResponse.json({ error: 'telefone eh obrigatorio' }, { status: 400 });
  }

  // Limpar telefone: remover DDI 55, manter DDD+numero
  let tel = telefone.replace(/\D/g, '');
  if (tel.startsWith('55') && tel.length >= 12) {
    tel = tel.substring(2);
  }
  // Versao sem 9o digito para busca (celular antigo)
  let telSem9 = tel;
  if (tel.length === 11) {
    telSem9 = tel.substring(0, 2) + tel.substring(3);
  }

  try {
    // Buscar paciente por telefone nos 3 campos
    const pacienteResult = await queryLatin1(`
      SELECT
        p.cod_paciente,
        p.nom_paciente_completo::bytea as nom_paciente_completo,
        p.dat_nascimento,
        p.nom_resp::bytea as nom_resp,
        p.des_email
      FROM arq_paciente p
      WHERE
        REPLACE(REPLACE(TRIM(COALESCE(p.num_ddd1,'') || COALESCE(p.num_telefone1,'')), '-', ''), ' ', '') IN ($1, $2)
        OR REPLACE(REPLACE(TRIM(COALESCE(p.num_ddd2,'') || COALESCE(p.num_telefone2,'')), '-', ''), ' ', '') IN ($1, $2)
        OR REPLACE(REPLACE(TRIM(COALESCE(p.num_ddd3,'') || COALESCE(p.num_telefone3,'')), '-', ''), ' ', '') IN ($1, $2)
      LIMIT 1
    `, [tel, telSem9],
    ['nom_paciente_completo', 'nom_resp']);

    if (pacienteResult.rows.length === 0) {
      return NextResponse.json({ encontrado: false });
    }

    const paciente = pacienteResult.rows[0];
    const codPaciente = paciente.cod_paciente;

    // Proximo agendamento (data futura)
    const proximoResult = await queryLatin1(`
      SELECT
        a.dat_agenda, a.des_hora, a.ind_status,
        a.des_procedimento::bytea as des_procedimento,
        m.nom_guerra::bytea as nom_guerra,
        m.nom_medico::bytea as nom_medico
      FROM arq_agendal a
      LEFT JOIN arq_medico m ON m.id_medico = a.id_medico
      WHERE a.cod_paciente = $1
        AND a.dat_agenda >= CURRENT_DATE
        AND (a.ind_status IS NULL OR a.ind_status NOT IN ('B'))
      ORDER BY a.dat_agenda ASC, a.des_hora ASC
      LIMIT 1
    `, [codPaciente],
    ['des_procedimento', 'nom_guerra', 'nom_medico']);

    // Ultimos 5 agendamentos
    const historicoResult = await queryLatin1(`
      SELECT
        a.dat_agenda, a.des_hora, a.ind_status,
        a.des_procedimento::bytea as des_procedimento,
        m.nom_guerra::bytea as nom_guerra,
        m.nom_medico::bytea as nom_medico
      FROM arq_agendal a
      LEFT JOIN arq_medico m ON m.id_medico = a.id_medico
      WHERE a.cod_paciente = $1
        AND (a.ind_status IS NULL OR a.ind_status NOT IN ('B'))
      ORDER BY a.dat_agenda DESC, a.des_hora DESC
      LIMIT 5
    `, [codPaciente],
    ['des_procedimento', 'nom_guerra', 'nom_medico']);

    // Formatar datas
    const formatDate = (d: unknown) => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    return NextResponse.json({
      encontrado: true,
      paciente: {
        cod_paciente: codPaciente,
        nome: paciente.nom_paciente_completo,
        nascimento: formatDate(paciente.dat_nascimento),
        responsavel: paciente.nom_resp || null,
        email: paciente.des_email || null,
      },
      proximo: proximoResult.rows.length > 0 ? {
        data: formatDate(proximoResult.rows[0].dat_agenda),
        hora: proximoResult.rows[0].des_hora,
        medico: proximoResult.rows[0].nom_guerra || proximoResult.rows[0].nom_medico,
        procedimento: proximoResult.rows[0].des_procedimento,
        status: proximoResult.rows[0].ind_status,
      } : null,
      historico: historicoResult.rows.map(r => ({
        data: formatDate(r.dat_agenda),
        hora: r.des_hora,
        medico: r.nom_guerra || r.nom_medico,
        procedimento: r.des_procedimento,
        status: r.ind_status,
      })),
    });
  } catch (err) {
    console.error('[api/agenda/paciente] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
