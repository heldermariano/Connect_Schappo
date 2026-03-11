import { NextRequest, NextResponse } from 'next/server';
import examesPool from '@/lib/db-exames';
import pool from '@/lib/db';

// Valida token bot (N8N) — middleware ja libera, mas checamos aqui tambem
function validateBotToken(request: NextRequest): boolean {
  const botToken = request.headers.get('x-bot-token');
  const secret = process.env.WEBHOOK_SECRET;
  return !!botToken && !!secret && botToken === secret;
}

export async function GET(request: NextRequest) {
  if (!validateBotToken(request)) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
  }

  const tecnicoNome = request.nextUrl.searchParams.get('tecnico_nome')?.trim();
  const data = request.nextUrl.searchParams.get('data')?.trim(); // YYYY-MM-DD

  if (!tecnicoNome) {
    return NextResponse.json({ error: 'tecnico_nome obrigatorio' }, { status: 400 });
  }

  try {
    // Buscar exames do dia no neuro_schappo filtrados pelo nome do tecnico
    const dataFiltro = data || new Date().toISOString().split('T')[0];

    const examsResult = await examesPool.query(
      `SELECT
        e.id AS exam_id,
        p.name AS patient_name,
        e.exam_date,
        e.exam_type,
        e.status,
        e.device_model,
        e.location_code,
        COALESCE(e.technician, p.companion_name) AS technician,
        e.requesting_doctor,
        e.created_at
      FROM exams e
      JOIN patients p ON p.id = e.patient_id
      WHERE e.exam_date::date = $1::date
        AND (
          LOWER(COALESCE(e.technician, '')) LIKE '%' || LOWER($2) || '%'
          OR LOWER(COALESCE(p.companion_name, '')) LIKE '%' || LOWER($2) || '%'
        )
      ORDER BY e.created_at DESC`,
      [dataFiltro, tecnicoNome],
    );

    // Buscar alertas de ficha (campos faltantes) para esses exames
    const examIds = examsResult.rows.map((r) => r.exam_id);
    let alertasMap = new Map<string, { campos_faltantes: string[]; total_campos_ok: number }>();

    if (examIds.length > 0) {
      const alertasResult = await pool.query(
        `SELECT exam_id, campos_faltantes, total_campos_ok
         FROM atd.eeg_alertas_ficha
         WHERE exam_id = ANY($1::uuid[])`,
        [examIds],
      );
      for (const row of alertasResult.rows) {
        alertasMap.set(row.exam_id, {
          campos_faltantes: row.campos_faltantes || [],
          total_campos_ok: row.total_campos_ok || 0,
        });
      }
    }

    // Buscar status de laudo (clinical_reports)
    let laudoMap = new Map<string, string>();
    if (examIds.length > 0) {
      const laudoResult = await examesPool.query(
        `SELECT exam_id, status FROM clinical_reports WHERE exam_id = ANY($1::uuid[])`,
        [examIds],
      );
      for (const row of laudoResult.rows) {
        laudoMap.set(row.exam_id, row.status);
      }
    }

    // Buscar vinculos existentes
    let vinculoMap = new Map<string, { eeg_exame_id: number; status: string }>();
    if (examIds.length > 0) {
      const vinculoResult = await pool.query(
        `SELECT neuro_exam_id, eeg_exame_id, status
         FROM atd.eeg_exame_ficha_vinculo
         WHERE neuro_exam_id = ANY($1::uuid[])`,
        [examIds],
      );
      for (const row of vinculoResult.rows) {
        vinculoMap.set(row.neuro_exam_id, {
          eeg_exame_id: row.eeg_exame_id,
          status: row.status,
        });
      }
    }

    const exames = examsResult.rows.map((row) => {
      const alerta = alertasMap.get(row.exam_id);
      const laudo = laudoMap.get(row.exam_id);
      const vinculo = vinculoMap.get(row.exam_id);

      return {
        exam_id: row.exam_id,
        patient_name: row.patient_name,
        exam_date: row.exam_date,
        exam_type: row.exam_type,
        status: row.status,
        device_model: row.device_model,
        location_code: row.location_code,
        technician: row.technician,
        requesting_doctor: row.requesting_doctor,
        report_status: laudo || null,
        campos_faltantes: alerta?.campos_faltantes || [],
        total_campos_ok: alerta?.total_campos_ok ?? null,
        vinculo: vinculo || null,
      };
    });

    return NextResponse.json({ exames, total: exames.length });
  } catch (err) {
    console.error('[api/eeg/exames-tecnico] Erro:', err);
    return NextResponse.json({ error: 'Erro ao buscar exames do tecnico' }, { status: 500 });
  }
}
