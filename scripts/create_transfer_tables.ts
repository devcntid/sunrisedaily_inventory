import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });
config();

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set in .env.local');
}

async function migrate() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to database...');
  await client.connect();

  console.log('Creating outlet_transfers and outlet_transfer_items tables...');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS "public"."outlet_transfers" (
      "id" BIGSERIAL PRIMARY KEY,
      "transfer_number" VARCHAR(50) NOT NULL UNIQUE,
      "from_outlet_id" BIGINT REFERENCES "public"."outlets"("id") ON DELETE CASCADE,
      "to_outlet_id" BIGINT NOT NULL REFERENCES "public"."outlets"("id") ON DELETE CASCADE,
      "requested_by" BIGINT REFERENCES "public"."users"("id") ON DELETE SET NULL,
      "approved_by" BIGINT REFERENCES "public"."users"("id") ON DELETE SET NULL,
      "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
      "notes" TEXT,
      "rejection_reason" TEXT,
      "total_cost" NUMERIC(15, 2) NOT NULL DEFAULT 0,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "approved_at" TIMESTAMPTZ,
      "received_at" TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS "public"."outlet_transfer_items" (
      "id" BIGSERIAL PRIMARY KEY,
      "transfer_id" BIGINT NOT NULL REFERENCES "public"."outlet_transfers"("id") ON DELETE CASCADE,
      "item_id" BIGINT NOT NULL REFERENCES "public"."items"("id") ON DELETE RESTRICT,
      "requested_qty" NUMERIC(12, 2) NOT NULL,
      "received_qty" NUMERIC(12, 2) NOT NULL DEFAULT 0,
      "unit" VARCHAR(50) NOT NULL,
      "cost_per_unit" NUMERIC(15, 2) NOT NULL DEFAULT 0,
      "subtotal_cost" NUMERIC(15, 2) NOT NULL DEFAULT 0,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_outlet_transfers_from_outlet ON "public"."outlet_transfers"("from_outlet_id");
    CREATE INDEX IF NOT EXISTS idx_outlet_transfers_to_outlet ON "public"."outlet_transfers"("to_outlet_id");
    CREATE INDEX IF NOT EXISTS idx_outlet_transfers_status ON "public"."outlet_transfers"("status");
    CREATE INDEX IF NOT EXISTS idx_outlet_transfer_items_transfer ON "public"."outlet_transfer_items"("transfer_id");
    CREATE INDEX IF NOT EXISTS idx_outlet_transfer_items_item ON "public"."outlet_transfer_items"("item_id");
  `);

  await client.end();
  console.log('Tables created successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
