import { Pool } from 'pg';

const chatwootPool = new Pool({
  host: process.env.CHATWOOT_DB_HOST || '10.150.77.88',
  port: parseInt(process.env.CHATWOOT_DB_PORT || '5432'),
  user: process.env.CHATWOOT_DB_USER || 'postgres',
  password: process.env.CHATWOOT_DB_PASSWORD,
  database: process.env.CHATWOOT_DB_NAME || 'chatwoot_production',
  max: 3,
  idleTimeoutMillis: 30000,
});

export default chatwootPool;
