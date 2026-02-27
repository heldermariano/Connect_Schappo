import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import examesPool from '@/lib/db-exames';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const grupo = session.user.grupo || 'todos';
  if (!['recepcao', 'eeg', 'todos'].includes(grupo)) {
    return NextResponse.json({ error: 'Sem permissao para buscar exames' }, { status: 403 });
  }

  const nome = request.nextUrl.searchParams.get('nome')?.trim();
  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Nome deve ter ao menos 2 caracteres' }, { status: 400 });
  }

  if (!process.env.EXAMES_DB_HOST || !process.env.EXAMES_DB_NAME) {
    return NextResponse.json({ error: 'Banco de exames nao configurado' }, { status: 503 });
  }

  try {
    // Busca apenas o ULTIMO exame por paciente + todos os arquivos desse exame
    // 1) Subquery pega o exam mais recente de cada paciente
    // 2) Join com reports para pegar os PDFs (laudo, tracado)
    const result = await examesPool.query(
      `WITH latest_exams AS (
         SELECT DISTINCT ON (p.id)
           p.id AS patient_id,
           p.name AS paciente,
           e.id AS exam_id,
           e.exam_type AS tipo_exame,
           e.exam_date AS data_exame,
           e.status AS exam_status,
           e.location_code AS local,
           COALESCE(e.technician, p.companion_name) AS tecnico,
           COALESCE(e.patient_phone, p.phone) AS telefone_paciente,
           e.convenio
         FROM patients p
         JOIN exams e ON e.patient_id = p.id
         WHERE LOWER(p.name_normalized) LIKE LOWER('%' || $1 || '%')
         ORDER BY p.id, e.exam_date DESC
       )
       SELECT DISTINCT ON (le.exam_id, COALESCE(r.filename, ''))
         le.paciente,
         le.exam_id,
         le.tipo_exame,
         le.data_exame,
         le.exam_status,
         le.local,
         le.tecnico,
         le.telefone_paciente,
         le.convenio,
         cr.status AS laudo_status,
         r.report_type AS arquivo_tipo,
         r.filename AS arquivo_nome,
         r.download_url
       FROM latest_exams le
       LEFT JOIN clinical_reports cr ON cr.exam_id = le.exam_id
       LEFT JOIN reports r ON r.exam_id = le.exam_id
         AND r.matched = true
         AND r.report_type IN ('laudo', 'tracado', 'laudo_tracado')
         AND r.download_url IS NOT NULL
       ORDER BY le.exam_id, COALESCE(r.filename, ''), r.created_at DESC`,
      [nome],
    );

    // Agrupar por paciente (1 exame por paciente)
    const examesMap = new Map<string, {
      paciente: string;
      tipo_exame: string;
      data_exame: string;
      status: string;
      local: string | null;
      tecnico: string | null;
      telefone_paciente: string | null;
      convenio: string | null;
      arquivos: { tipo: string; nome: string; download_url: string }[];
    }>();

    for (const row of result.rows) {
      const key = row.exam_id;

      if (!examesMap.has(key)) {
        let status: string;
        if (row.laudo_status === 'delivered') {
          status = 'entregue';
        } else if (row.laudo_status === 'signed') {
          status = 'assinado';
        } else if (row.laudo_status === 'reported' || row.laudo_status === 'in_progress') {
          status = 'em_laudo';
        } else if (row.exam_status === 'delivered') {
          status = 'realizado';
        } else {
          status = 'registrado';
        }

        let dataExame = '';
        if (row.data_exame) {
          const d = row.data_exame instanceof Date ? row.data_exame : new Date(row.data_exame);
          dataExame = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        examesMap.set(key, {
          paciente: row.paciente,
          tipo_exame: row.tipo_exame || 'EEG',
          data_exame: dataExame,
          status,
          local: row.local || null,
          tecnico: row.tecnico || null,
          telefone_paciente: row.telefone_paciente || null,
          convenio: row.convenio || null,
          arquivos: [],
        });
      }

      if (row.arquivo_nome && row.download_url) {
        examesMap.get(key)!.arquivos.push({
          tipo: row.arquivo_tipo,
          nome: row.arquivo_nome,
          download_url: row.download_url,
        });
      }
    }

    const resultados = Array.from(examesMap.values());
    return NextResponse.json({ resultados, total: resultados.length });
  } catch (err) {
    console.error('[api/exames/buscar] Erro:', err);
    return NextResponse.json({ error: 'Erro ao buscar exames' }, { status: 500 });
  }
}
