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

  const paciente = request.nextUrl.searchParams.get('paciente')?.trim();
  const aparelho = request.nextUrl.searchParams.get('aparelho')?.trim();
  const data = request.nextUrl.searchParams.get('data')?.trim();

  if (!paciente && !aparelho) {
    return NextResponse.json({ error: 'Informe paciente e/ou aparelho' }, { status: 400 });
  }

  try {
    const dataFiltro = data || new Date().toISOString().split('T')[0];

    // Montar query dinamicamente baseada nos filtros
    const conditions: string[] = [`e.exam_date::date = $1::date`];
    const params: (string | null)[] = [dataFiltro];
    let paramIdx = 2;

    if (paciente) {
      conditions.push(`LOWER(p.name) LIKE '%' || LOWER($${paramIdx}) || '%'`);
      params.push(paciente);
      paramIdx++;
    }

    if (aparelho) {
      conditions.push(`LOWER(e.device_model) LIKE '%' || LOWER($${paramIdx}) || '%'`);
      params.push(aparelho);
      paramIdx++;
    }

    const result = await examesPool.query(
      `SELECT
        e.id AS exam_id,
        p.id AS patient_id,
        p.name AS patient_name,
        p.birth_date,
        p.sex,
        p.phone,
        p.responsible,
        e.exam_date,
        e.exam_type,
        e.status,
        e.device_model,
        e.location_code,
        COALESCE(e.technician, p.companion_name) AS technician,
        e.requesting_doctor,
        e.indication,
        e.cid,
        e.previous_exams,
        e.created_at
      FROM exams e
      JOIN patients p ON p.id = e.patient_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.created_at DESC
      LIMIT 10`,
      params,
    );

    // Verificar campos faltantes (usando logica do ficha-validator)
    const fichas = await Promise.all(
      result.rows.map(async (row) => {
        // Buscar alerta existente
        const alertaResult = await pool.query(
          `SELECT campos_faltantes, total_campos_ok, corrigido
           FROM atd.eeg_alertas_ficha
           WHERE exam_id = $1`,
          [row.exam_id],
        );
        const alerta = alertaResult.rows[0] || null;

        // Buscar vinculo existente
        const vinculoResult = await pool.query(
          `SELECT id, eeg_exame_id, status
           FROM atd.eeg_exame_ficha_vinculo
           WHERE neuro_exam_id = $1
           ORDER BY created_at DESC LIMIT 1`,
          [row.exam_id],
        );
        const vinculo = vinculoResult.rows[0] || null;

        return {
          exam_id: row.exam_id,
          patient_id: row.patient_id,
          patient_name: row.patient_name,
          birth_date: row.birth_date,
          sex: row.sex,
          phone: row.phone,
          exam_date: row.exam_date,
          exam_type: row.exam_type,
          status: row.status,
          device_model: row.device_model,
          location_code: row.location_code,
          technician: row.technician,
          requesting_doctor: row.requesting_doctor,
          indication: row.indication,
          campos_faltantes: alerta?.campos_faltantes || [],
          total_campos_ok: alerta?.total_campos_ok ?? null,
          ficha_corrigida: alerta?.corrigido ?? null,
          vinculo: vinculo
            ? { id: vinculo.id, eeg_exame_id: vinculo.eeg_exame_id, status: vinculo.status }
            : null,
        };
      }),
    );

    return NextResponse.json({ fichas, total: fichas.length });
  } catch (err) {
    console.error('[api/eeg/ficha] Erro:', err);
    return NextResponse.json({ error: 'Erro ao buscar ficha' }, { status: 500 });
  }
}
