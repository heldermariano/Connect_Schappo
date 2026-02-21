import { Pool } from 'pg';

// Pool de conexao PostgreSQL — schema atd
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Seta search_path para o schema atd em cada conexao
pool.on('connect', (client) => {
  client.query('SET search_path TO atd, public');
});

export default pool;
