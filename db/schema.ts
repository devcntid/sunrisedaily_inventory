import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Contoh skema. 
// PERHATIAN: Drizzle di proyek ini HANYA digunakan untuk keperluan migrasi (drizzle-kit).
// Dilarang keras menggunakan Drizzle sebagai query builder / ORM pada saat runtime sesuai aturan AGENTS.md.
// Silakan definisikan skema Anda di sini untuk di-generate menjadi SQL migrasi.

// export const exampleTable = pgTable('example', {
//   id: serial('id').primaryKey(),
//   name: text('name').notNull(),
//   createdAt: timestamp('created_at').defaultNow(),
// });
