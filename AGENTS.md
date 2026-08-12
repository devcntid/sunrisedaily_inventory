# **AGENTS.md**

Instructions for all AI coding agents (Claude Code, Cursor, Copilot Workspace, or other agents) working in the **Centralized Procurement & Inventory System** repository.

Complete technical reference: **TRD.md**. Physical schema reference: 01\_schema.sql / schema\_dan\_seed.sql. This file serves as an **architectural contract** — agents must not deviate from the points below without explicit approval from the repository maintainer (human).

## **Project Scope**

An internal application to manage item requests between outlets, purchases to vendors, central warehouse inventory (*Moving Average* method), Delivery Orders (Surat Jalan) \+ barcode scanning, Stock Opname, and *reorder point* notifications, used by 7 STORE outlets \+ 1 CENTRAL\_KITCHEN.

## **Architectural Rules (Hard Rules)**

* **Rendering:** Next.js App Router, **SSR**, optimized for loading speed & SEO. Do not build as a SPA. Standalone .html/.jsx files are for visual reference only, not for production. Default to *Server Component*; "use client" only in interactive components.  
* **Hosting:** Vercel (one project for UI \+ API).  
* **File/Image Storage:** Vercel Blob Storage. No binary/base64 in database columns — URLs only.  
* **Database:** Neon Postgres serverless, accessed via pg with **raw parameterized SQL queries** — no ORMs.  
* **API Structure:** one model \= one file app/api/{model}/route.ts.  
* **Query Separation — mandatory:** All raw SQL must reside in lib/queries/{model}.ts. Route Handlers and Server Components call functions from there; **there must be no** inline client.query(...) in route.ts or in any .tsx components.  
* **Drizzle:** only for drizzle-kit generate/migrate and **idempotent** seeds. It must not be used as a query builder/ORM in any form during runtime.  
* **Primary/Foreign Key:** BIGSERIAL/BIGINT (not UUID) — according to the v3.1 migration in the physical schema.  
* **Enumerative columns:** VARCHAR \+ documented *valid values*, not native Postgres ENUM.  
* **Reusability:** repeated UI components must become shared components (components/ui/, components/shared/), no markup duplication across pages.  
* **High-traffic performance:** utilize Server Components, caching/revalidate for Master Data, pagination/virtualized lists for large tables, and a small pg.Pool \+ Neon's *pooled connection string* (to avoid connection exhaustion).

## **Fixed Dependencies**

pdf (PDF generation), xlsx (Excel export), dnd-kit (drag & drop), recharts (charts), tiptap (rich text), bwip-js/jsbarcode (generate barcode images), @zxing/browser (scan barcode via camera), zustand (client state), @tanstack/react-query (client data fetching/refetch), pg (db client), drizzle-kit (migrate/seed only).

Do not add other ORMs, other SPA frameworks, or storage libraries other than Vercel Blob without strong reasons discussed beforehand. **No digital signature feature** — proof of Delivery Order handover is entirely based on *generating* barcodes (in Item Master Data) and *scanning* OUT/IN barcodes (in the central warehouse & outlets).

## **Design System (Admin Panel)**

* Sidebar toggle-able, responsive (collapse-to-icon on desktop, off-canvas drawer on mobile).  
* Heading font: **Cabin**. General font: **Albert Sans**. Loaded via next/font/google.  
* Primary color: **\#016e3f**. Base color: **\#ffffff**. Registered as Tailwind design tokens.

## **Pre-Commit Checklist**

* \[ \] No SQL strings in route.ts or .tsx files — all are in lib/queries/{model}.ts.  
* \[ \] All queries use placeholders $1, $2, ..., no string interpolation into SQL.  
* \[ \] No db.select()/Drizzle query builder in runtime code.  
* \[ \] New column types follow BIGSERIAL/BIGINT, not UUID.  
* \[ \] New status columns use VARCHAR \+ documented valid values, not ENUM.  
* \[ \] New pages default to Server Component; "use client" is used only in necessary components.  
* \[ \] New file uploads are directed to Vercel Blob Storage, not stored as base64/binary.  
* \[ \] New schemas are synced to TRD.md Section 3 and idempotent migration/seed scripts.  
* \[ \] Repeated UI components are placed in components/ui/ or components/shared/, not copied-pasted.
