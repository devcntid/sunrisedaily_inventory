/**
 * Apply Drizzle SQL migrations (schema only). Not an ORM runtime path.
 *
 * Usage: npm run db:migrate
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

config({ path: '.env.local' });

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set in .env.local');
}

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  console.log('[db:migrate] Connecting to Neon (unpooled)...');
  await client.connect();

  const db = drizzle(client);
  console.log('[db:migrate] Applying migrations from ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });

  await client.end();
  console.log('[db:migrate] Done.');
}

main().catch((err) => {
  console.error('[db:migrate] Failed:', err);
  process.exit(1);
});
