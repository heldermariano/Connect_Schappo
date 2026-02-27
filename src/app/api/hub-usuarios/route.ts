import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import examesPool from '@/lib/db-exames';
import { HubUsuario } from '@/lib/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  // Queries em paralelo: tecnicos + alertas de hoje + exames de hoje
  const [tecnicosRes, alertasRes, examesRes] = await Promise.all([
    pool.query(`SELECT * FROM atd.hub_usuarios WHERE ativo = TRUE ORDER BY nome`),

    pool.query(`
      SELECT tecnico_id,
        COUNT(*) FILTER (WHERE data_exame::date = CURRENT_DATE)::int AS alertas_hoje,
        COUNT(*) FILTER (WHERE corrigido = FALSE)::int AS pendentes,
        COUNT(*) FILTER (WHERE corrigido = TRUE AND data_exame::date = CURRENT_DATE)::int AS corrigidos
      FROM atd.eeg_alertas_ficha
      WHERE data_exame::date >= CURRENT_DATE - INTERVAL '7 days'
        AND tecnico_id IS NOT NULL
      GROUP BY tecnico_id
    `),

    examesPool.query(`
      SELECT COALESCE(e.technician, p.companion_name) AS tecnico_nome, COUNT(*)::int AS exames_hoje
      FROM exams e
      JOIN patients p ON p.id = e.patient_id
      WHERE e.exam_date::date = CURRENT_DATE AND p.birth_date IS NOT NULL
      GROUP BY COALESCE(e.technician, p.companion_name)
    `).catch(() => ({ rows: [] as Array<{ tecnico_nome: string; exames_hoje: number }> })),
  ]);

  // Indexar alertas por tecnico_id
  const alertasMap = new Map<number, { alertas_hoje: number; pendentes: number; corrigidos: number }>();
  for (const row of alertasRes.rows) {
    alertasMap.set(row.tecnico_id, {
      alertas_hoje: row.alertas_hoje,
      pendentes: row.pendentes,
      corrigidos: row.corrigidos,
    });
  }

  // Indexar exames por nome do tecnico (partial match case-insensitive)
  const examesRows = examesRes.rows as Array<{ tecnico_nome: string; exames_hoje: number }>;

  // Enriquecer cada tecnico com resumo
  const usuarios = tecnicosRes.rows.map((u: HubUsuario) => {
    const alerta = alertasMap.get(u.id) || { alertas_hoje: 0, pendentes: 0, corrigidos: 0 };

    // Match exames por nome (companion_name pode conter o nome completo ou parcial)
    let exames_hoje = 0;
    const nomeNorm = u.nome.toLowerCase().trim();
    for (const ex of examesRows) {
      if (!ex.tecnico_nome) continue;
      const companion = ex.tecnico_nome.toLowerCase().trim();
      if (companion.includes(nomeNorm) || nomeNorm.includes(companion)) {
        exames_hoje += ex.exames_hoje;
      }
    }

    return {
      ...u,
      resumo: {
        exames_hoje,
        alertas_hoje: alerta.alertas_hoje,
        pendentes: alerta.pendentes,
        corrigidos: alerta.corrigidos,
      },
    };
  });

  return NextResponse.json({ usuarios });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const body = await request.json();
  const { nome, telefone, cargo, setor } = body;

  if (!nome?.trim() || !telefone?.trim()) {
    return NextResponse.json({ error: 'Nome e telefone sao obrigatorios' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO atd.hub_usuarios (nome, telefone, cargo, setor)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nome.trim(), telefone.trim(), cargo?.trim() || 'Técnico EEG', setor?.trim() || null],
    );

    return NextResponse.json({ usuario: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Ja existe um usuario com esse telefone' }, { status: 409 });
    }
    throw err;
  }
}
