import { Redis } from 'ioredis';

const REDIS_TTL_SECONDS = 72 * 60 * 60; // 72 hours

let _redis: Redis | null = null;
let _available = false;

export async function getRedis(): Promise<Redis | null> {
  if (_redis) return _available ? _redis : null;

  const url = process.env['REDIS_URL'];
  if (!url) return null;

  const client = new Redis(url, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // do not retry on startup
  });

  try {
    await client.connect();
    _available = true;
    _redis = client;
  } catch {
    _available = false;
    client.disconnect();
  }

  return _available ? _redis : null;
}

export async function redisGet(key: string): Promise<string | null> {
  const client = await getRedis();
  if (!client) return null;
  return client.get(key);
}

export async function redisSet(key: string, value: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;
  await client.set(key, value, 'EX', REDIS_TTL_SECONDS);
}

export async function redisDel(key: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;
  await client.del(key);
}

export function contextKey(agentId: string): string {
  return `context:${agentId}:active`;
}
