import { Pool } from 'pg';

function createPool(connectionString: string | undefined, max?: number): Pool {
  const p = new Pool({ connectionString, max });
  p.on('connect', (client) => {
    client.query("SET search_path TO atd, public; SET timezone TO 'America/Sao_Paulo'");
  });
  return p;
}

// Pool principal (escrita) — usado por rotas que fazem INSERT/UPDATE/DELETE
const pool = createPool(process.env.DATABASE_URL);

// Pool somente leitura — usa DATABASE_READ_URL se disponivel, senao fallback para DATABASE_URL
export const poolRead = createPool(
  process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
  15,
);

export default pool;
