import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

/**
 * Drizzle is used ONLY for migrate & seed (not as a runtime ORM).
 * Runtime queries stay in lib/queries/*.ts via raw parameterized SQL (pg).
 */
const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set in .env.local');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url,
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
  strict: true,
  verbose: true,
});
