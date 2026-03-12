import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Conexao principal (comandos gerais)
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[redis] Erro de conexao:', err.message);
});

redis.on('connect', () => {
  console.log('[redis] Conectado');
});

// Cria instancia separada para subscriber (pub/sub exige conexao dedicada)
export function createSubscriber(): Redis {
  const sub = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
  sub.on('error', (err) => {
    console.error('[redis:sub] Erro de conexao:', err.message);
  });
  return sub;
}

export default redis;
