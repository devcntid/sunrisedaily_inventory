@AGENTS.md

# **CLAUDE.md**

Working guide for Claude (Claude Code) when working on the **Centralized Procurement & Inventory System** repository.

The complete technical source of truth document is in **TRD.md** (Technical Requirements Document). Read that document for detailed database schemas, business algorithms (Moving Average, UOM conversion, Reorder Point), and the list of API endpoints. This file (CLAUDE.md) is a **summary of mandatory operational rules** to ensure the generated code is consistent — do not deviate from this without explicit confirmation from the user.

## **Architectural Rules — Non-Negotiable**

1. **SSR only, not a SPA.** All pages are built with **Next.js App Router**, optimized for loading speed and SEO. The default page.tsx is a **Server Component**; "use client" is only used in child components that truly need interactivity. Standalone .html or loose .jsx files can only be used as **visual references**, never as production code.  
2. **Deploy target: Vercel.** One project, one deployment for both UI \+ API.  
3. **File/image storage: Vercel Blob Storage.** Do not store binary/base64 in the database. The \*\_url columns in the schema always store the URL resulting from the Blob upload. **No digital signature feature** — proof of Delivery Order (Surat Jalan) handover uses *generate* \+ *scan* barcode (see TRD Section 4.5), not uploading a signature image.  
4. **Database: Neon Postgres (serverless), raw SQL queries — not an ORM.** Use pg (node-postgres) with *parameterized queries* ($1, $2, ...). It is **strictly forbidden** to use direct string interpolation into SQL.  
5. **One model \= one route.** Each resource has its own app/api/{model}/route.ts (e.g., app/api/items/route.ts, app/api/orders/route.ts).  
6. **Raw queries MUST be separated from components and route handlers.** All client.query(...)/query(...) live in lib/queries/{model}.ts — one file per model. Both Server Components (initial render) and Route Handlers (mutations from the Client) call functions from this file, never writing SQL directly in route.ts or in .tsx files.  
7. **Drizzle is only for migrate & seed — not an ORM, not a query builder, not even in the slightest.** Use drizzle-kit generate/migrate, and **idempotent** seed scripts (safe to run repeatedly, using explicit id \+ OVERRIDING SYSTEM VALUE / ON CONFLICT, following the pattern in 02\_seed\_master.sql).  
8. **Primary/Foreign Key: BIGSERIAL/BIGINT**, not UUID. Small, readable IDs, following the final physical schema (01\_schema.sql).  
9. **Status/type columns: VARCHAR with documented *valid values***, not native Postgres ENUM.  
10. **High-traffic optimization but still user-friendly**: Server Components to reduce Client JS load, revalidate/cache for Master Data, *pagination*/*virtualized lists* for large tables (Stock Cards), a small pg.Pool \+ NeonDB *pooled connection* (see TRD Section 2.2) to avoid hitting the *connection limit*.  
11. **Modern architecture, reusable components.** Do not rewrite the same *markup* across multiple pages — all repeating UI elements belong in components/ui/ (base) and components/shared/ (domain composite).

## **Required Dependencies**

| Requirement | Library |
| :---- | :---- |
| PDF (Delivery Orders, reports) | pdf (e.g., @react-pdf/renderer) |
| Excel Export | xlsx (e.g., exceljs) |
| Drag & drop | dnd-kit |
| Charts/graphs | recharts |
| Rich text editor | tiptap |
| Generate barcode images | bwip-js (or jsbarcode) |
| Scan barcodes via camera | @zxing/browser |
| Client-only state | zustand |
| Client-side data fetching | @tanstack/react-query |
| DB client | pg (node-postgres) |
| Migration/seed | drizzle-kit (not a runtime ORM) |

## **Design System (Admin Panel)**

* **Sidebar must be toggle-able & responsive** — *collapse to icon* on desktop, *off-canvas drawer* on mobile/tablet.  
* **Heading font:** Cabin. **General font:** Albert Sans. Both via next/font/google.  
* **Primary color:** \#016e3f. **Base color:** \#ffffff. Register as Tailwind tokens (bg-primary, text-primary), do not hardcode scattered hex values.

## **Before Writing Code**

* Check TRD.md Section 3 for the latest table structure (BIGSERIAL/BIGINT, VARCHAR status columns) before writing any queries.  
* Check Section 2.3 for the lib/queries/{model}.ts folder pattern and transaction examples (withTransaction).  
* Check Section 4 for core business logic (Moving Average, UOM conversion, Reorder Point) before implementing related endpoints — do not recalculate formulas from scratch without referring there.  
* If there are schema changes, sync them in three places: Drizzle schema (/db/schema), SQL migration files, and TRD.md Section 3 — do not let the three diverge.
