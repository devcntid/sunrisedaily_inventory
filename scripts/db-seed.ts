/**
 * Run SQL seed files with raw pg (no Drizzle query builder).
 *
 * Usage: npm run db:seed
 */
import { config } from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { Client } from 'pg';

config({ path: '.env.local' });

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set in .env.local');
}

/** Split SQL into executable chunks without breaking dollar-quoted DO blocks. */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const ch = sql[i];

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }

    if (inSingle) {
      buf += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }

    if (ch === '$') {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (m) {
        dollarTag = m[0];
        buf += m[0];
        i += m[0].length;
        continue;
      }
    }

    if (ch === '-' && sql[i + 1] === '-') {
      // line comment
      while (i < sql.length && sql[i] !== '\n') {
        buf += sql[i];
        i++;
      }
      continue;
    }

    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt.length > 0) statements.push(stmt);
      buf = '';
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function main() {
  const seedsDir = path.resolve('db/seeds');
  const files = (await readdir(seedsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .sql seed files found in ${seedsDir}`);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  console.log('[db:seed] Connecting to Neon (unpooled)...');
  await client.connect();
  await client.query("SET statement_timeout = '0'");

  try {
    for (const file of files) {
      const full = path.join(seedsDir, file);
      console.log(`[db:seed] Running ${file} ...`);
      const sql = await readFile(full, 'utf8');
      const statements = splitSqlStatements(sql);
      console.log(`[db:seed] ${statements.length} statements`);

      for (let idx = 0; idx < statements.length; idx++) {
        const stmt = statements[idx];
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
        if (idx % 10 === 0 || idx === statements.length - 1) {
          console.log(`[db:seed] (${idx + 1}/${statements.length}) ${preview}...`);
        }
        await client.query(stmt);
      }
      console.log(`[db:seed] Finished ${file}`);
    }
  } finally {
    await client.end();
  }

  console.log('[db:seed] Done.');
}

main().catch((err) => {
  console.error('[db:seed] Failed:', err);
  process.exit(1);
});
