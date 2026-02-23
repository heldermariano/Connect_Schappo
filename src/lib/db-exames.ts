import { Pool } from 'pg';

// Pool separado para banco externo de resultados de exames (somente leitura)
const examesPool = new Pool({
  host: process.env.EXAMES_DB_HOST,
  port: parseInt(process.env.EXAMES_DB_PORT || '5432'),
  database: process.env.EXAMES_DB_NAME,
  user: process.env.EXAMES_DB_USER,
  password: process.env.EXAMES_DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
});

export default examesPool;
