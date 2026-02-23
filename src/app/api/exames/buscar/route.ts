import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import examesPool from '@/lib/db-exames';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  // Verificar permissao: apenas recepcao, eeg ou todos
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
    // Busca exames do paciente com arquivos PDF (laudo, tracado, etc.)
    // Banco: neuro_schappo (schema public)
    // Tabelas: patients -> exams -> reports (PDFs) + clinical_reports (status laudo)
    const result = await examesPool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (e.id, COALESCE(r.filename, ''))
           p.name AS paciente,
           e.id AS exam_id,
           e.exam_type AS tipo_exame,
           e.exam_date AS data_exame,
           e.status AS exam_status,
           e.location_code AS local,
           cr.status AS laudo_status,
           r.report_type AS arquivo_tipo,
           r.filename AS arquivo_nome,
           r.dest_path AS arquivo_path
         FROM patients p
         JOIN exams e ON e.patient_id = p.id
         LEFT JOIN clinical_reports cr ON cr.exam_id = e.id
         LEFT JOIN reports r ON r.exam_id = e.id
           AND r.matched = true
           AND r.report_type IN ('laudo', 'tracado', 'laudo_tracado')
         WHERE LOWER(p.name_normalized) LIKE LOWER('%' || $1 || '%')
         ORDER BY e.id, COALESCE(r.filename, ''), r.created_at DESC
       ) sub
       ORDER BY data_exame DESC, arquivo_tipo ASC
       LIMIT 50`,
      [nome],
    );

    // Agrupar por exame (exam_id)
    const examesMap = new Map<string, {
      paciente: string;
      tipo_exame: string;
      data_exame: string;
      status: string;
      local: string | null;
      arquivos: { tipo: string; nome: string; path: string }[];
    }>();

    for (const row of result.rows) {
      const key = row.exam_id;

      if (!examesMap.has(key)) {
        // Determinar status para o atendente
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

        // Formatar data como string YYYY-MM-DD (pg retorna Date object)
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
          arquivos: [],
        });
      }

      // Adicionar arquivo se existir
      if (row.arquivo_nome && row.arquivo_path) {
        examesMap.get(key)!.arquivos.push({
          tipo: row.arquivo_tipo,
          nome: row.arquivo_nome,
          path: row.arquivo_path,
        });
      }
    }

    const resultados = Array.from(examesMap.values()).slice(0, 20);
    return NextResponse.json({ resultados, total: resultados.length });
  } catch (err) {
    console.error('[api/exames/buscar] Erro:', err);
    return NextResponse.json({ error: 'Erro ao buscar exames' }, { status: 500 });
  }
}
