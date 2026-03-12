import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/api-auth';
import { queryLatin1 } from '@/lib/db-agenda';
import pool from '@/lib/db';
import { normalizePhone } from '@/lib/types';

// Campos texto do banco schappo que precisam de conversao LATIN1→UTF8
const BYTEA_FIELDS = [
  'nom_paciente_completo', 'des_email', 'nom_resp', 'convenio',
  'des_procedimento', 'mem_obs', 'des_tipo_fone1', 'des_tipo_fone2', 'des_tipo_fone3',
  'nom_medico', 'nom_guerra', 'mem_zap_pers_agendado',
];

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const medicoId = searchParams.get('medico');
  const data = searchParams.get('data');

  if (!medicoId || !data) {
    return NextResponse.json({ error: 'medico e data sao obrigatorios' }, { status: 400 });
  }

  try {
    // Buscar agendamentos no banco externo (schappo)
    // Campos texto com ::bytea para conversao LATIN1→UTF8
    const agendaResult = await queryLatin1(`
      SELECT
        a.chave, a.dat_agenda, a.des_hora, a.ind_status,
        a.des_procedimento::bytea as des_procedimento,
        a.mem_obs::bytea as mem_obs,
        p.cod_paciente,
        p.nom_paciente_completo::bytea as nom_paciente_completo,
        p.des_email::bytea as des_email,
        p.num_ddd1, p.num_telefone1,
        p.des_tipo_fone1::bytea as des_tipo_fone1,
        p.num_ddd2, p.num_telefone2,
        p.des_tipo_fone2::bytea as des_tipo_fone2,
        p.num_ddd3, p.num_telefone3,
        p.des_tipo_fone3::bytea as des_tipo_fone3,
        p.dat_nascimento,
        p.nom_resp::bytea as nom_resp,
        c.nom_reduzido::bytea AS convenio
      FROM arq_agendal a
      LEFT JOIN arq_paciente p ON p.cod_paciente = a.cod_paciente
      LEFT JOIN tab_convenio c ON c.id_convenio = a.id_convenio
      WHERE a.id_medico = $1
        AND a.dat_agenda = $2
        AND a.cod_paciente IS NOT NULL
        AND (a.ind_status IS NULL OR a.ind_status NOT IN ('B', 'D'))
      ORDER BY a.des_hora
    `, [parseInt(medicoId), data], BYTEA_FIELDS);

    if (agendaResult.rows.length === 0) {
      return NextResponse.json({ agendamentos: [] });
    }

    // Buscar dados de confirmacao local para esses agendamentos
    const chaves = agendaResult.rows.map((r) => (r as Record<string, unknown>).chave as number);
    const confirmResult = await pool.query(
      `SELECT id, chave_agenda, telefone_envio, wa_message_id, status, enviado_at, respondido_at, enviado_por
       FROM atd.confirmacao_agendamento
       WHERE chave_agenda = ANY($1)`,
      [chaves]
    );
    const confirmMap = new Map<number, typeof confirmResult.rows[0]>();
    for (const row of confirmResult.rows) {
      confirmMap.set(row.chave_agenda, row);
    }

    // Montar lista de agendamentos com telefones e status de confirmacao
    const agendamentos = agendaResult.rows.map((row: Record<string, unknown>) => {
      // Montar array de telefones
      const telefones: Array<{ ddd: string; numero: string; tipo: string }> = [];
      for (let i = 1; i <= 3; i++) {
        const ddd = row[`num_ddd${i}`] as string | null;
        const num = row[`num_telefone${i}`] as string | null;
        const tipo = row[`des_tipo_fone${i}`] as string | null;
        if (ddd && num) {
          telefones.push({
            ddd: String(ddd).trim(),
            numero: String(num).trim().replace(/\D/g, ''),
            tipo: (String(tipo || '')).trim().toLowerCase(),
          });
        }
      }

      // Selecionar melhor telefone para WhatsApp (priorizar celular)
      let telefoneWhatsapp: string | null = null;
      const celular = telefones.find(t => t.tipo === 'celular' || t.tipo === 'cel');
      if (celular) {
        telefoneWhatsapp = normalizePhone(`${celular.ddd}${celular.numero}`);
      } else if (telefones.length > 0) {
        telefoneWhatsapp = normalizePhone(`${telefones[0].ddd}${telefones[0].numero}`);
      }

      const confirm = confirmMap.get(row.chave as number);

      return {
        chave: row.chave,
        dat_agenda: row.dat_agenda,
        des_hora: row.des_hora,
        ind_status: row.ind_status,
        des_procedimento: row.des_procedimento,
        mem_obs: row.mem_obs,
        cod_paciente: row.cod_paciente,
        nom_paciente_completo: row.nom_paciente_completo,
        des_email: row.des_email,
        telefones,
        dat_nascimento: row.dat_nascimento,
        nom_resp: row.nom_resp,
        convenio: row.convenio,
        telefone_whatsapp: telefoneWhatsapp,
        confirmacao: confirm ? {
          id: confirm.id,
          telefone_envio: confirm.telefone_envio,
          wa_message_id: confirm.wa_message_id,
          status: confirm.status,
          enviado_at: confirm.enviado_at,
          respondido_at: confirm.respondido_at,
          enviado_por: confirm.enviado_por,
        } : null,
      };
    });

    // Buscar medico para retornar template personalizado
    const medicoResult = await queryLatin1(
      `SELECT nom_medico::bytea as nom_medico,
              nom_guerra::bytea as nom_guerra,
              mem_zap_pers_agendado::bytea as mem_zap_pers_agendado
       FROM arq_medico WHERE id_medico = $1`,
      [parseInt(medicoId)],
      ['nom_medico', 'nom_guerra', 'mem_zap_pers_agendado']
    );
    const medico = medicoResult.rows[0] || null;

    return NextResponse.json({
      agendamentos,
      medico: medico ? {
        nom_medico: medico.nom_medico,
        nom_guerra: medico.nom_guerra,
        template_whatsapp: medico.mem_zap_pers_agendado || null,
      } : null,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[api/agenda/agendamentos] Erro:', errMsg, err);
    return NextResponse.json({ error: `Erro ao buscar agendamentos: ${errMsg}` }, { status: 500 });
  }
}
