import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL has not been set in environment variables (.env)');
}

// Singleton: created once per warm serverless instance, not per-request
// Neon serverless: keep max low to avoid connection exhaustion (free tier ~5 connections)
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,                          // Dinaikkan dari 3→5 untuk mendukung 10 user concurrent.
    // SSL dikontrol penuh oleh parameter sslmode=verify-full di DATABASE_URL
    // Jangan set ssl:{} secara manual agar tidak konflik dengan channel_binding=require
    idleTimeoutMillis: 30000,        // Neon sering disconnect setelah idle
    connectionTimeoutMillis: 30000,  // Neon cold start bisa sampai ~20s; 30s memberi ruang aman
    keepAlive: true,                 // Cegah koneksi idle di-drop oleh firewall/proxy Neon
    keepAliveInitialDelayMillis: 10000,
  });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Always assign to global so the pool is reused across hot reloads and invocations
globalForPg.pgPool = pool;

// query() helper — strictly parameterized, no string interpolation allowed
// Includes exponential-backoff retry for transient Neon cold-start / idle eviction errors
const TRANSIENT_ERRORS = [
  'Connection terminated',
  'connection timeout',
  'timeout exceeded',   // Neon cold-start: "timeout exceeded when trying to connect"
  'ECONNRESET',
  'ECONNREFUSED',
  'connect ETIMEDOUT',
  'end called on pool',
];

// Retry delays (ms): 1s → 3s → 5s (Neon cold start bisa butuh hingga 20 detik)
const RETRY_DELAYS = [1000, 3000, 5000];

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await pool.query<T>(text, params);
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      const isTransient = TRANSIENT_ERRORS.some(e => msg.includes(e));

      if (isTransient && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[db] Transient connection error (attempt ${attempt + 1}/${RETRY_DELAYS.length}), retrying in ${delay}ms:`, msg);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let transactionError: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err: any) {
    transactionError = err;
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
    throw err;
  } finally {
    client.release(transactionError);
  }
}
