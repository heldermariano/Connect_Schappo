import { Pool, QueryResult, QueryResultRow } from 'pg';

// Pool separado para banco externo do ERP (schappo) — somente leitura
// Banco usa encoding SQL_ASCII com dados em LATIN1
const agendaPool = new Pool({
  host: process.env.AGENDA_DB_HOST || '10.150.77.61',
  port: parseInt(process.env.AGENDA_DB_PORT || '5432'),
  database: process.env.AGENDA_DB_NAME || 'schappo',
  user: process.env.AGENDA_DB_USER || 'usuariobackup',
  password: process.env.AGENDA_DB_PASSWORD || 'usuariobackup',
  max: 3,
  idleTimeoutMillis: 30000,
});

agendaPool.on('connect', (client) => {
  client.query("SET timezone TO 'America/Sao_Paulo'");
});

/**
 * Converte campos de texto LATIN1 (retornados como bytea) para UTF-8.
 * O banco schappo é SQL_ASCII com dados em LATIN1.
 * Campos texto passam pelo pg como UTF-8 e bytes > 127 viram U+FFFD.
 * Solucao: queries devem usar campo::bytea para campos com acentos,
 * e esta funcao converte o Buffer resultante para string UTF-8.
 */
export function latin1ToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Buffer.isBuffer(value)) {
    return value.toString('latin1');
  }
  return String(value);
}

/**
 * Converte todos os campos Buffer (bytea) de uma row para strings UTF-8.
 * Usado para processar resultado de queries com campos::bytea.
 */
export function convertRow<T extends QueryResultRow>(row: T, byteaFields: string[]): T {
  const converted = { ...row } as Record<string, unknown>;
  for (const field of byteaFields) {
    if (field in converted) {
      converted[field] = latin1ToString(converted[field]);
    }
  }
  return converted as T;
}

/**
 * Executa query e converte campos bytea LATIN1 para UTF-8.
 * @param text SQL query
 * @param values Parametros
 * @param byteaFields Lista de campos que foram castados como ::bytea na query
 */
export async function queryLatin1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
  byteaFields: string[] = []
): Promise<QueryResult<T>> {
  const result = await agendaPool.query<T>(text, values);
  if (byteaFields.length > 0) {
    result.rows = result.rows.map(row => convertRow(row, byteaFields));
  }
  return result;
}

/**
 * Atualiza o status do agendamento no banco Konsyst (arq_agendal).
 * Mapeamento: confirmado → ind_status='C', desmarcou → ind_status='D'+ind_desmarcou='P',
 *             reagendar → ind_status='D'+ind_desmarcou='R'
 * Requer GRANT UPDATE no arq_agendal para o usuario do pool.
 */
export async function atualizarStatusKonsyst(
  chaveAgenda: number,
  statusConnect: 'confirmado' | 'desmarcou' | 'reagendar',
): Promise<boolean> {
  try {
    let indStatus: string;
    let indDesmarcou: string | null;

    switch (statusConnect) {
      case 'confirmado':
        indStatus = 'C';
        indDesmarcou = null;
        break;
      case 'desmarcou':
        indStatus = 'D';
        indDesmarcou = 'P';
        break;
      case 'reagendar':
        indStatus = 'D';
        indDesmarcou = 'R';
        break;
      default:
        return false;
    }

    const result = await agendaPool.query(
      `UPDATE arq_agendal SET ind_status = $1, ind_desmarcou = $2 WHERE chave = $3`,
      [indStatus, indDesmarcou, chaveAgenda],
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`[db-agenda] Konsyst atualizado: chave=${chaveAgenda} ind_status=${indStatus} ind_desmarcou=${indDesmarcou || 'null'}`);
      return true;
    }
    console.warn(`[db-agenda] Konsyst: chave ${chaveAgenda} nao encontrada`);
    return false;
  } catch (err) {
    console.error(`[db-agenda] Erro ao atualizar Konsyst chave=${chaveAgenda}:`, err);
    return false;
  }
}

export default agendaPool;
