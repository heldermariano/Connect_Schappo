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

export default agendaPool;
