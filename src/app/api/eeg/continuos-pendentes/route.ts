import { NextRequest, NextResponse } from 'next/server';
import examesPool from '@/lib/db-exames';
import pool from '@/lib/db';

function validateBotToken(request: NextRequest): boolean {
  const botToken = request.headers.get('x-bot-token');
  const secret = process.env.WEBHOOK_SECRET;
  return !!botToken && !!secret && botToken === secret;
}

export async function GET(request: NextRequest) {
  if (!validateBotToken(request)) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
  }

  try {
    // Buscar vinculos ativos marcados como continuo
    const vinculosResult = await pool.query(
      `SELECT id, eeg_exame_id, neuro_exam_id, caixa_codigo, tecnico_nome,
              paciente_nome, aparelho, status, assumido_por_nome, assumido_em,
              created_at
       FROM atd.eeg_exame_ficha_vinculo
       WHERE is_continuo = TRUE AND status = 'ativo'
       ORDER BY created_at DESC
       LIMIT 50`,
    );

    if (vinculosResult.rows.length === 0) {
      return NextResponse.json({ exames: [], total: 0 });
    }

    // Buscar dados complementares do neuro_schappo para exames com neuro_exam_id
    const neuroIds = vinculosResult.rows
      .filter((r) => r.neuro_exam_id)
      .map((r) => r.neuro_exam_id);

    let neuroMap = new Map<
      string,
      {
        patient_name: string;
        device_model: string;
        location_code: string;
        exam_type: string;
        status: string;
        requesting_doctor: string;
      }
    >();

    if (neuroIds.length > 0) {
      const neuroResult = await examesPool.query(
        `SELECT
          e.id AS exam_id,
          p.name AS patient_name,
          e.device_model,
          e.location_code,
          e.exam_type,
          e.status,
          e.requesting_doctor
        FROM exams e
        JOIN patients p ON p.id = e.patient_id
        WHERE e.id = ANY($1::uuid[])`,
        [neuroIds],
      );

      for (const row of neuroResult.rows) {
        neuroMap.set(row.exam_id, {
          patient_name: row.patient_name,
          device_model: row.device_model,
          location_code: row.location_code,
          exam_type: row.exam_type,
          status: row.status,
          requesting_doctor: row.requesting_doctor,
        });
      }
    }

    // Buscar alertas de ficha para esses exames
    let alertasMap = new Map<string, { campos_faltantes: string[]; total_campos_ok: number }>();
    if (neuroIds.length > 0) {
      const alertasResult = await pool.query(
        `SELECT exam_id, campos_faltantes, total_campos_ok
         FROM atd.eeg_alertas_ficha
         WHERE exam_id = ANY($1::uuid[])`,
        [neuroIds],
      );
      for (const row of alertasResult.rows) {
        alertasMap.set(row.exam_id, {
          campos_faltantes: row.campos_faltantes || [],
          total_campos_ok: row.total_campos_ok || 0,
        });
      }
    }

    const exames = vinculosResult.rows.map((vinculo) => {
      const neuro = vinculo.neuro_exam_id ? neuroMap.get(vinculo.neuro_exam_id) : null;
      const alerta = vinculo.neuro_exam_id ? alertasMap.get(vinculo.neuro_exam_id) : null;

      return {
        vinculo_id: vinculo.id,
        eeg_exame_id: vinculo.eeg_exame_id,
        neuro_exam_id: vinculo.neuro_exam_id,
        caixa_codigo: vinculo.caixa_codigo,
        tecnico_nome: vinculo.tecnico_nome,
        paciente_nome: neuro?.patient_name || vinculo.paciente_nome,
        aparelho: neuro?.device_model || vinculo.aparelho,
        location_code: neuro?.location_code || null,
        exam_type: neuro?.exam_type || null,
        requesting_doctor: neuro?.requesting_doctor || null,
        neuro_status: neuro?.status || null,
        campos_faltantes: alerta?.campos_faltantes || [],
        total_campos_ok: alerta?.total_campos_ok ?? null,
        assumido_por_nome: vinculo.assumido_por_nome,
        assumido_em: vinculo.assumido_em,
        created_at: vinculo.created_at,
      };
    });

    return NextResponse.json({ exames, total: exames.length });
  } catch (err) {
    console.error('[api/eeg/continuos-pendentes] Erro:', err);
    return NextResponse.json({ error: 'Erro ao buscar continuos pendentes' }, { status: 500 });
  }
}
