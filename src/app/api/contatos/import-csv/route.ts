import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/contatos/import-csv — Import contatos de CSV exportado do Chatwoot.
 * Formato esperado: id,name,email,phone_number (com header)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo CSV obrigatorio' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV vazio ou sem dados' }, { status: 400 });
    }

    // Pular header
    const dataLines = lines.slice(1);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Processar em batches de 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
      const batch = dataLines.slice(i, i + BATCH_SIZE);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const line of batch) {
        const cols = parseCsvLine(line);
        if (cols.length < 4) {
          skipped++;
          continue;
        }

        const [chatwootId, name, email, phoneRaw] = cols;

        // Nome obrigatorio
        const nome = name?.trim();
        if (!nome) {
          skipped++;
          continue;
        }

        // Normalizar telefone
        const telefone = normalizePhone(phoneRaw);
        const emailClean = email?.trim() || null;
        const cwId = parseInt(chatwootId, 10) || null;

        // Precisamos de pelo menos telefone ou email
        if (!telefone && !emailClean) {
          skipped++;
          continue;
        }

        placeholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
        values.push(nome, telefone, emailClean, cwId);
        paramIdx += 4;
      }

      if (placeholders.length === 0) continue;

      // Bulk upsert via ON CONFLICT
      const query = `
        INSERT INTO atd.contatos (nome, telefone, email, chatwoot_id)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (telefone) WHERE telefone IS NOT NULL AND telefone != ''
        DO UPDATE SET
          nome = COALESCE(EXCLUDED.nome, atd.contatos.nome),
          email = COALESCE(EXCLUDED.email, atd.contatos.email),
          chatwoot_id = COALESCE(EXCLUDED.chatwoot_id, atd.contatos.chatwoot_id),
          updated_at = NOW()
        RETURNING (xmax = 0) AS is_new
      `;

      try {
        const result = await pool.query(query, values);
        for (const row of result.rows) {
          if (row.is_new) imported++;
          else updated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
      }
    }

    return NextResponse.json({ imported, updated, skipped, errors });
  } catch (err) {
    console.error('[api/contatos/import-csv] Erro:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/** Normalizar telefone: remover +, non-digits; garantir prefixo 55 */
function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let phone = raw.replace(/\D/g, '');
  if (!phone || phone.length < 8) return null;
  // Adicionar prefixo 55 se nao tiver
  if (!phone.startsWith('55') && phone.length <= 11) {
    phone = '55' + phone;
  }
  return phone;
}

/** Parser CSV simples com suporte a campos entre aspas */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
