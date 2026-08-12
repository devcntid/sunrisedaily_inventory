-- Generated from neondb-sunrise.sql (schema only)
-- Drizzle migration: 0000_init
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS "public"."items" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_local_purchases" CASCADE;
DROP TABLE IF EXISTS "public"."users" CASCADE;
DROP TABLE IF EXISTS "public"."categories" CASCADE;
DROP TABLE IF EXISTS "public"."outlets" CASCADE;
DROP TABLE IF EXISTS "public"."orders" CASCADE;
DROP TABLE IF EXISTS "public"."stock_count_headers" CASCADE;
DROP TABLE IF EXISTS "public"."vendors" CASCADE;
DROP TABLE IF EXISTS "public"."menus" CASCADE;
DROP TABLE IF EXISTS "public"."menu_categories" CASCADE;
DROP TABLE IF EXISTS "public"."delivery_notes" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_menu_prices" CASCADE;
DROP TABLE IF EXISTS "public"."direct_purchases" CASCADE;
DROP TABLE IF EXISTS "public"."direct_purchase_items" CASCADE;
DROP TABLE IF EXISTS "public"."moka_item_sales" CASCADE;
DROP TABLE IF EXISTS "public"."order_items" CASCADE;
DROP TABLE IF EXISTS "public"."price_history" CASCADE;
DROP TABLE IF EXISTS "public"."shopping_list_histories" CASCADE;
DROP TABLE IF EXISTS "public"."venues" CASCADE;
DROP TABLE IF EXISTS "public"."item_venues" CASCADE;
DROP TABLE IF EXISTS "public"."recipe_ingredients" CASCADE;
DROP TABLE IF EXISTS "public"."recipes" CASCADE;
DROP TABLE IF EXISTS "public"."ingredients" CASCADE;
DROP TABLE IF EXISTS "public"."goods_receipt_items" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_inventory_logs" CASCADE;
DROP TABLE IF EXISTS "public"."sales_transactions" CASCADE;
DROP TABLE IF EXISTS "public"."system_settings" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_venues" CASCADE;
DROP TABLE IF EXISTS "public"."moka_item_variants" CASCADE;
DROP TABLE IF EXISTS "public"."moka_items" CASCADE;
DROP TABLE IF EXISTS "public"."moka_business" CASCADE;
DROP TABLE IF EXISTS "public"."moka_tokens" CASCADE;
DROP TABLE IF EXISTS "public"."barcode_scan_logs" CASCADE;
DROP TABLE IF EXISTS "public"."stock_alerts" CASCADE;
DROP TABLE IF EXISTS "public"."moka_transaction_items" CASCADE;
DROP TABLE IF EXISTS "public"."inventory_logs" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_item_settings" CASCADE;
DROP TABLE IF EXISTS "public"."sales_transaction_items" CASCADE;
DROP TABLE IF EXISTS "public"."stock_count_details" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_stocks" CASCADE;
DROP TABLE IF EXISTS "public"."outlet_local_purchase_items" CASCADE;
DROP TABLE IF EXISTS "public"."purchase_orders" CASCADE;
DROP TABLE IF EXISTS "public"."delivery_note_issues" CASCADE;
DROP TABLE IF EXISTS "public"."moka_transactions" CASCADE;
DROP TABLE IF EXISTS "public"."moka_customers" CASCADE;
DROP TABLE IF EXISTS "public"."delivery_note_items" CASCADE;
DROP TABLE IF EXISTS "public"."moka_oauth_states" CASCADE;
DROP TABLE IF EXISTS "public"."goods_receipts" CASCADE;
DROP TABLE IF EXISTS "public"."purchase_order_items" CASCADE;

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS items_id_seq;
CREATE SEQUENCE IF NOT EXISTS outlet_local_purchases_id_seq;
CREATE SEQUENCE IF NOT EXISTS users_id_seq;
CREATE SEQUENCE IF NOT EXISTS categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS outlets_id_seq;
CREATE SEQUENCE IF NOT EXISTS orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS stock_count_headers_id_seq;
CREATE SEQUENCE IF NOT EXISTS vendors_id_seq;
CREATE SEQUENCE IF NOT EXISTS menus_id_seq;
CREATE SEQUENCE IF NOT EXISTS menu_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS delivery_notes_id_seq;
CREATE SEQUENCE IF NOT EXISTS direct_purchases_id_seq;
CREATE SEQUENCE IF NOT EXISTS direct_purchase_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS moka_item_sales_id_seq;
CREATE SEQUENCE IF NOT EXISTS order_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS price_history_id_seq;
CREATE SEQUENCE IF NOT EXISTS shopping_list_histories_id_seq;
CREATE SEQUENCE IF NOT EXISTS venues_id_seq;
CREATE SEQUENCE IF NOT EXISTS recipe_ingredients_id_seq;
CREATE SEQUENCE IF NOT EXISTS recipes_id_seq;
CREATE SEQUENCE IF NOT EXISTS ingredients_id_seq;
CREATE SEQUENCE IF NOT EXISTS goods_receipt_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS outlet_inventory_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS sales_transactions_id_seq;
CREATE SEQUENCE IF NOT EXISTS moka_tokens_id_seq;
CREATE SEQUENCE IF NOT EXISTS barcode_scan_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS stock_alerts_id_seq;
CREATE SEQUENCE IF NOT EXISTS inventory_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS outlet_item_settings_id_seq;
CREATE SEQUENCE IF NOT EXISTS sales_transaction_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS stock_count_details_id_seq;
CREATE SEQUENCE IF NOT EXISTS outlet_local_purchase_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS purchase_orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS delivery_note_issues_id_seq;
CREATE SEQUENCE IF NOT EXISTS delivery_note_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS goods_receipts_id_seq;
CREATE SEQUENCE IF NOT EXISTS purchase_order_items_id_seq;

-- Table Definition
CREATE TABLE "public"."items" (

    "id" int8 NOT NULL DEFAULT nextval('items_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "category_id" int8 NOT NULL,
    "barcode" varchar(100),
    "purchase_unit" varchar(50) NOT NULL,
    "smallest_unit" varchar(50) NOT NULL,
    "conversion_ratio" numeric(10,2) NOT NULL DEFAULT 1.00,
    "minimum_threshold" numeric(10,2) NOT NULL DEFAULT 0,
    "threshold_type" varchar(20) NOT NULL DEFAULT 'ABSOLUT'::character varying,
    "computed_threshold_cache" numeric(15,2),
    "is_perishable" bool NOT NULL DEFAULT false,
    "is_active" bool NOT NULL DEFAULT true,
    "current_average_price" numeric(15,2) NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "ingredient_id" int8,
    "target_stock" numeric(10,2) NOT NULL DEFAULT 0,
    "last_purchase_price" numeric(15,4) DEFAULT 0,
    "is_split_allowed" bool DEFAULT false,
    "min_order_qty" numeric DEFAULT 1,
    "order_multiple" numeric DEFAULT 1,
    "package_inner_size" varchar,
    "parent_id" int8,
    "is_global" bool DEFAULT true,
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."items"."threshold_type" IS 'Valid values (validated in frontend): PERSENTASE, ABSOLUT';


-- Indices
CREATE UNIQUE INDEX items_name_key ON public.items USING btree (name);
CREATE UNIQUE INDEX items_barcode_key ON public.items USING btree (barcode);
CREATE INDEX idx_items_category_id ON public.items USING btree (category_id);
CREATE INDEX idx_items_is_active ON public.items USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_items_barcode ON public.items USING btree (barcode) WHERE (barcode IS NOT NULL);
CREATE INDEX idx_items_name_trgm ON public.items USING gin (name gin_trgm_ops);

-- Table Definition
CREATE TABLE "public"."outlet_local_purchases" (

    "id" int8 NOT NULL DEFAULT nextval('outlet_local_purchases_id_seq'::regclass),
    "outlet_id" int8,
    "purchase_date" date NOT NULL,
    "receipt_url" varchar(255) NOT NULL,
    "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "is_read_by_central" bool DEFAULT false,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."users" (

    "id" int8 NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "email" varchar(255) NOT NULL,
    "password_hash" varchar(255),
    "role" varchar(30) NOT NULL,
    "outlet_id" int8,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."users"."role" IS 'Valid values (validated in frontend): ADMIN_OUTLET, ADMIN_PUSAT';


-- Indices
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_users_outlet_id ON public.users USING btree (outlet_id);
CREATE INDEX idx_users_role ON public.users USING btree (role);

-- Table Definition
CREATE TABLE "public"."categories" (

    "id" int8 NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);

-- Table Definition
CREATE TABLE "public"."outlets" (

    "id" int8 NOT NULL DEFAULT nextval('outlets_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "type" varchar(30) NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "pic_name" varchar(255),
    "email" varchar(255),
    "phone" varchar(50),
    "map_location" text,
    "is_active" bool DEFAULT true,
    "address" text,
    "street" text,
    "street2" text,
    "city" varchar(100),
    "state" varchar(100),
    "zip" varchar(20),
    "country" varchar(100),
    "venue_id" int8,
    "moka_business_id" int8,
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."outlets"."type" IS 'Valid values (validated in frontend): STORE, CENTRAL_KITCHEN';


-- Indices
CREATE UNIQUE INDEX outlets_name_key ON public.outlets USING btree (name);

-- Table Definition
CREATE TABLE "public"."orders" (

    "id" int8 NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
    "outlet_id" int8 NOT NULL,
    "order_date" date NOT NULL DEFAULT CURRENT_DATE,
    "delivery_date" date NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'PENDING'::character varying,
    "created_by" int8 NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."orders"."status" IS 'Valid values: PENDING, PROCESSING, COMPLETED, DIBATALKAN (CANCELLED adalah alias lama)';


-- Indices
CREATE INDEX idx_orders_outlet_id ON public.orders USING btree (outlet_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_created_by ON public.orders USING btree (created_by);
CREATE INDEX idx_orders_order_date ON public.orders USING btree (order_date DESC);
CREATE INDEX idx_orders_outlet_status ON public.orders USING btree (outlet_id, status);

-- Table Definition
CREATE TABLE "public"."stock_count_headers" (

    "id" int8 NOT NULL DEFAULT nextval('stock_count_headers_id_seq'::regclass),
    "location_type" varchar(10) NOT NULL,
    "location_id" int8,
    "count_date" date NOT NULL DEFAULT CURRENT_DATE,
    "pic_id" int8 NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'DRAFT'::character varying,
    "total_value" numeric(15,2) NOT NULL DEFAULT 0,
    "general_notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."stock_count_headers"."location_type" IS 'Valid values (validated in frontend): PUSAT, OUTLET';
COMMENT ON COLUMN "public"."stock_count_headers"."status" IS 'Valid values (validated in frontend): DRAFT, SUBMITTED, LOCKED';


-- Indices
CREATE INDEX idx_count_headers_location ON public.stock_count_headers USING btree (location_type, location_id);
CREATE INDEX idx_count_headers_status ON public.stock_count_headers USING btree (status);
CREATE INDEX idx_count_headers_pic_id ON public.stock_count_headers USING btree (pic_id);
CREATE INDEX idx_count_headers_date ON public.stock_count_headers USING btree (count_date DESC);

-- Table Definition
CREATE TABLE "public"."vendors" (

    "id" int8 NOT NULL DEFAULT nextval('vendors_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "contact" varchar(100),
    "address" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "email" varchar(255),
    "phone" varchar(50),
    "tax_id" varchar(50),
    "website" varchar(255),
    "type" varchar(50) DEFAULT 'Company'::character varying,
    "street" text,
    "street2" text,
    "city" varchar(100),
    "state" varchar(100),
    "zip" varchar(20),
    "country" varchar(100),
    "contact_person" varchar(100),
    "logo_url" text,
    "is_active" bool DEFAULT true,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."menus" (

    "id" int8 NOT NULL DEFAULT nextval('menus_id_seq'::regclass),
    "category_id" int8 NOT NULL,
    "name" varchar(200) NOT NULL,
    "variant" varchar(100),
    "display_name" varchar(300),
    "sale_price" int4 NOT NULL DEFAULT 0,
    "hpp" numeric(12,2),
    "hpp_ratio" numeric(8,6),
    "notes" varchar(500),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX menus_display_name_key ON public.menus USING btree (display_name);
CREATE INDEX idx_menus_category_id ON public.menus USING btree (category_id);
CREATE INDEX idx_menus_name ON public.menus USING btree (name);
CREATE INDEX idx_menus_display_name ON public.menus USING btree (display_name);
CREATE INDEX idx_menus_sale_price ON public.menus USING btree (sale_price);

-- Table Definition
CREATE TABLE "public"."menu_categories" (

    "id" int8 NOT NULL DEFAULT nextval('menu_categories_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX menu_categories_name_uq ON public.menu_categories USING btree (name);

-- Table Definition
CREATE TABLE "public"."delivery_notes" (

    "id" int8 NOT NULL DEFAULT nextval('delivery_notes_id_seq'::regclass),
    "delivery_note_number" varchar(100) NOT NULL,
    "order_id" int8,
    "outlet_id" int8 NOT NULL,
    "delivery_date" date NOT NULL DEFAULT CURRENT_DATE,
    "driver_name" varchar(255),
    "recipient_name" varchar(255),
    "status" varchar(20) NOT NULL DEFAULT 'DRAFT'::character varying,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "proof_image_url" text,
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."delivery_notes"."status" IS 'Valid values: DRAFT, DIKIRIM, DITERIMA, DIBATALKAN';


-- Indices
CREATE UNIQUE INDEX delivery_notes_delivery_note_number_key ON public.delivery_notes USING btree (delivery_note_number);
CREATE INDEX idx_delivery_notes_order_id ON public.delivery_notes USING btree (order_id);
CREATE INDEX idx_delivery_notes_outlet_id ON public.delivery_notes USING btree (outlet_id);
CREATE INDEX idx_delivery_notes_status ON public.delivery_notes USING btree (status);
CREATE INDEX idx_delivery_notes_delivery_date ON public.delivery_notes USING btree (delivery_date DESC);

-- Table Definition
CREATE TABLE "public"."outlet_menu_prices" (

    "outlet_id" int8 NOT NULL,
    "menu_id" int8 NOT NULL,
    "sale_price" numeric(15,2) NOT NULL,
    PRIMARY KEY ("outlet_id","menu_id")
);

-- Table Definition
CREATE TABLE "public"."direct_purchases" (

    "id" int8 NOT NULL DEFAULT nextval('direct_purchases_id_seq'::regclass),
    "purchase_date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_number" varchar(100),
    "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
    "notes" text,
    "created_by" int8 NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_direct_purchases_date ON public.direct_purchases USING btree (purchase_date);

-- Table Definition
CREATE TABLE "public"."direct_purchase_items" (

    "id" int8 NOT NULL DEFAULT nextval('direct_purchase_items_id_seq'::regclass),
    "direct_purchase_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "brand_id" int8,
    "shop_name" varchar(255) NOT NULL,
    "qty" numeric(15,3) NOT NULL,
    "unit" varchar(50) NOT NULL,
    "unit_price" numeric(15,2) NOT NULL,
    "subtotal" numeric(15,2) NOT NULL,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_direct_purchase_items_dp_id ON public.direct_purchase_items USING btree (direct_purchase_id);
CREATE INDEX idx_direct_purchase_items_item_id ON public.direct_purchase_items USING btree (item_id);

-- Table Definition
CREATE TABLE "public"."moka_item_sales" (

    "id" int8 NOT NULL DEFAULT nextval('moka_item_sales_id_seq'::regclass),
    "outlet_id" int8,
    "name" text NOT NULL,
    "sku" text,
    "category_name" text,
    "item_sold" int4,
    "item_refunded" int4,
    "gross_sales" numeric(15,2),
    "discount" numeric(15,2),
    "refund" numeric(15,2),
    "net_sales" numeric(15,2),
    "cogs" numeric(15,2),
    "gross_profit" numeric(15,2),
    "period_start" date,
    "period_end" date,
    "sync_date" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "business_id" int8,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX uq_moka_item_sales ON public.moka_item_sales USING btree (outlet_id, name, category_name, period_start, period_end);

-- Table Definition
CREATE TABLE "public"."order_items" (

    "id" int8 NOT NULL DEFAULT nextval('order_items_id_seq'::regclass),
    "order_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "qty_request" numeric(10,3) NOT NULL,
    "additional_notes" varchar(255),
    "smallest_unit_qty" numeric(10,2),
    "fulfillment_status" varchar(20) NOT NULL DEFAULT 'MENUNGGU'::character varying,
    "item_status" varchar(30) NOT NULL DEFAULT 'DITERIMA_DARI_OUTLET'::character varying,
    "distribution_price" numeric(15,2),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "qty_approved" numeric(10,2),
    "approved_smallest_qty" numeric(10,2),
    "center_notes" text,
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."order_items"."fulfillment_status" IS 'Valid values (validated in frontend): MENUNGGU, SANGGUP, TIDAK';
COMMENT ON COLUMN "public"."order_items"."item_status" IS 'Valid values: DITERIMA_DARI_OUTLET, PROSES_BELANJA, READY_DI_GUDANG, DIKIRIM, SELESAI';


-- Indices
CREATE UNIQUE INDEX uq_order_item ON public.order_items USING btree (order_id, item_id);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_item_id ON public.order_items USING btree (item_id);
CREATE INDEX idx_order_items_item_status ON public.order_items USING btree (item_status);
CREATE INDEX idx_order_items_fulfillment_status ON public.order_items USING btree (fulfillment_status);

-- Table Definition
CREATE TABLE "public"."price_history" (

    "id" int8 NOT NULL DEFAULT nextval('price_history_id_seq'::regclass),
    "item_id" int8 NOT NULL,
    "vendor_id" int8,
    "purchase_date" date NOT NULL DEFAULT CURRENT_DATE,
    "purchase_qty" numeric(10,2) NOT NULL,
    "unit_purchase_price" numeric(15,2) NOT NULL,
    "new_average_price" numeric(15,2) NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "purchase_order_item_id" int8,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_price_history_item_id ON public.price_history USING btree (item_id);
CREATE INDEX idx_price_history_item_purchase_date ON public.price_history USING btree (item_id, purchase_date DESC);
CREATE INDEX idx_price_history_vendor_id ON public.price_history USING btree (vendor_id);
CREATE INDEX idx_price_history_po_item_id ON public.price_history USING btree (purchase_order_item_id) WHERE (purchase_order_item_id IS NOT NULL);

-- Table Definition
CREATE TABLE "public"."shopping_list_histories" (

    "id" int8 NOT NULL DEFAULT nextval('shopping_list_histories_id_seq'::regclass),
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "created_by" int8,
    "created_by_name" varchar(255),
    "total_items" int4 NOT NULL,
    "print_data" jsonb NOT NULL,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."venues" (

    "id" int8 NOT NULL DEFAULT nextval('venues_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX venues_name_uq ON public.venues USING btree (name);

-- Table Definition
CREATE TABLE "public"."item_venues" (

    "item_id" int8 NOT NULL,
    "venue_id" int8 NOT NULL,
    PRIMARY KEY ("item_id","venue_id")
);

-- Table Definition
CREATE TABLE "public"."recipe_ingredients" (

    "id" int8 NOT NULL DEFAULT nextval('recipe_ingredients_id_seq'::regclass),
    "recipe_id" int8 NOT NULL,
    "ingredient_id" int8 NOT NULL,
    "quantity" numeric(10,3) NOT NULL,
    "unit" varchar(20),
    "cost_per_unit" numeric(12,4),
    "extension" numeric(12,2),
    "sort_order" int4 NOT NULL DEFAULT 0,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_ri_recipe_id ON public.recipe_ingredients USING btree (recipe_id);
CREATE INDEX idx_ri_ingredient_id ON public.recipe_ingredients USING btree (ingredient_id);
CREATE INDEX idx_ri_recipe_sort ON public.recipe_ingredients USING btree (recipe_id, sort_order);

-- Table Definition
CREATE TABLE "public"."recipes" (

    "id" int8 NOT NULL DEFAULT nextval('recipes_id_seq'::regclass),
    "name" varchar(300) NOT NULL,
    "venue_id" int8 NOT NULL,
    "menu_id" int8,
    "yield_unit" varchar(20),
    "yield" numeric(10,3) NOT NULL DEFAULT 1,
    "subtotal" numeric(12,2),
    "x_factor_pct" numeric(5,4) NOT NULL DEFAULT 0.10,
    "total_cost" numeric(12,2),
    "sale_price" numeric(12,2),
    "revision_date" date,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_recipes_venue_id ON public.recipes USING btree (venue_id);
CREATE INDEX idx_recipes_menu_id ON public.recipes USING btree (menu_id);
CREATE INDEX idx_recipes_name ON public.recipes USING btree (name);
CREATE INDEX idx_recipes_yield_unit ON public.recipes USING btree (yield_unit);

-- Table Definition
CREATE TABLE "public"."ingredients" (

    "id" int8 NOT NULL DEFAULT nextval('ingredients_id_seq'::regclass),
    "name" varchar(200) NOT NULL,
    "default_unit" varchar(20),
    "standard_cost_per_unit" numeric(12,2),
    "description" varchar(300),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "item_id" int8,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX ingredients_name_uq ON public.ingredients USING btree (name);
CREATE INDEX idx_ingredients_name ON public.ingredients USING btree (name);

-- Table Definition
CREATE TABLE "public"."goods_receipt_items" (

    "id" int8 NOT NULL DEFAULT nextval('goods_receipt_items_id_seq'::regclass),
    "goods_receipt_id" int8 NOT NULL,
    "purchase_order_item_id" int8 NOT NULL,
    "item_id" int8,
    "qty_received" numeric(10,2),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_goods_receipt_items_receipt_id ON public.goods_receipt_items USING btree (goods_receipt_id);
CREATE INDEX idx_goods_receipt_items_po_item_id ON public.goods_receipt_items USING btree (purchase_order_item_id);

-- Table Definition
CREATE TABLE "public"."outlet_inventory_logs" (

    "id" int8 NOT NULL DEFAULT nextval('outlet_inventory_logs_id_seq'::regclass),
    "outlet_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "movement_type" varchar(20) NOT NULL,
    "qty_change" numeric(10,2) NOT NULL,
    "ending_balance" numeric(10,2) NOT NULL,
    "reference_type" varchar(30),
    "reference_id" int8,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."outlet_inventory_logs"."reference_type" IS 'Valid runtime values: ATOMIC_TRANSFER, PUBLIC_RECEIVE, OPNAME_ADJUSTMENT, MOKA_SALES';


-- Indices
CREATE INDEX idx_outlet_inventory_logs_outlet_item ON public.outlet_inventory_logs USING btree (outlet_id, item_id);
CREATE INDEX idx_outlet_inventory_logs_created_at ON public.outlet_inventory_logs USING btree (created_at DESC);

DROP VIEW IF EXISTS "public"."v_kitchen_hpp_summary";
 SELECT r.name AS recipe_name,
    r.yield AS yield_amount,
    r.yield_unit,
    COALESCE((m.sale_price)::numeric, r.sale_price, (0)::numeric) AS sale_price,
    r.subtotal AS raw_cost,
    r.total_cost AS total_cost_with_xfactor,
        CASE
            WHEN ((r.yield > (0)::numeric) AND ((r.yield_unit)::text <> 'pcs'::text)) THEN round((r.total_cost / r.yield), 2)
            ELSE r.total_cost
        END AS cost_per_unit_yield,
        CASE
            WHEN (COALESCE((m.sale_price)::numeric, r.sale_price, (0)::numeric) > (0)::numeric) THEN round(((100.0 * r.total_cost) / COALESCE((m.sale_price)::numeric, r.sale_price)), 1)
            ELSE NULL::numeric
        END AS hpp_ratio_pct
   FROM (recipes r
     LEFT JOIN menus m ON ((m.id = r.menu_id)))
  ORDER BY r.name;

DROP VIEW IF EXISTS "public"."v_ingredient_usage";
 SELECT i.name AS ingredient_name,
    i.default_unit,
    i.standard_cost_per_unit,
    count(DISTINCT ri.recipe_id) AS used_in_recipes,
    sum(ri.quantity) AS total_qty_across_recipes,
    min(ri.cost_per_unit) AS min_cost_used,
    max(ri.cost_per_unit) AS max_cost_used
   FROM (ingredients i
     JOIN recipe_ingredients ri ON ((ri.ingredient_id = i.id)))
  GROUP BY i.id, i.name, i.default_unit, i.standard_cost_per_unit
  ORDER BY (count(DISTINCT ri.recipe_id)) DESC;

DROP VIEW IF EXISTS "public"."v_hpp_vs_sale";
 SELECT c.name AS category,
    m.name AS menu_name,
    m.variant,
    m.sale_price,
    m.hpp,
    round((m.hpp_ratio * (100)::numeric), 2) AS hpp_pct,
        CASE
            WHEN (m.hpp_ratio < 0.35) THEN 'GREEN'::text
            WHEN (m.hpp_ratio < 0.50) THEN 'YELLOW'::text
            ELSE 'RED'::text
        END AS margin_flag
   FROM (menus m
     JOIN menu_categories c ON ((c.id = m.category_id)))
  ORDER BY c.name, m.name, m.variant;

-- Table Definition
CREATE TABLE "public"."sales_transactions" (

    "id" int8 NOT NULL DEFAULT nextval('sales_transactions_id_seq'::regclass),
    "outlet_id" int8 NOT NULL,
    "transaction_date" date NOT NULL DEFAULT CURRENT_DATE,
    "transaction_number" varchar(100),
    "total_amount" numeric(15,2) NOT NULL DEFAULT 0,
    "payment_method" varchar(50),
    "cashier_id" int8,
    "notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_sales_tx_outlet_date ON public.sales_transactions USING btree (outlet_id, transaction_date DESC);

-- Table Definition
CREATE TABLE "public"."system_settings" (

    "key" varchar(100) NOT NULL,
    "value" text,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("key")
);

-- Table Definition
CREATE TABLE "public"."outlet_venues" (

    "outlet_id" int8 NOT NULL,
    "venue_id" int8 NOT NULL,
    PRIMARY KEY ("outlet_id","venue_id")
);

-- Table Definition
CREATE TABLE "public"."moka_item_variants" (

    "id" int8 NOT NULL,
    "item_id" int8,
    "outlet_id" int8,
    "name" text,
    "price" numeric(15,2),
    "cogs" numeric(15,2),
    "in_stock" int4,
    "track_stock" bool,
    "sku" text,
    "is_deleted" bool,
    "synchronized_at" timestamptz,
    "updated_at" timestamptz,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "internal_recipe_id" int8,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."moka_items" (

    "id" int8 NOT NULL,
    "business_id" int8,
    "outlet_id" int8,
    "category_id" int8,
    "category_name" text,
    "name" text NOT NULL,
    "is_recipe" bool,
    "is_deleted" bool,
    "synchronized_at" timestamptz,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "is_sales_type_price" bool,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."moka_business" (

    "id" int8 NOT NULL,
    "name" text NOT NULL,
    "address" text,
    "city" text,
    "province" text,
    "postal_code" text,
    "phone" text,
    "user_id" int8,
    "synchronized_at" timestamptz,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."moka_tokens" (

    "id" int4 NOT NULL DEFAULT nextval('moka_tokens_id_seq'::regclass),
    "access_token" text NOT NULL,
    "refresh_token" text NOT NULL,
    "expires_in" int4 NOT NULL,
    "scope" text NOT NULL,
    "moka_created_at" int4 NOT NULL,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "business_id" int8,
    "account_name" varchar(255),
    "account_email" varchar(255),
    "is_active" bool DEFAULT true,
    "client_id" varchar(255),
    "client_secret" varchar(255),
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX moka_tokens_business_id_key ON public.moka_tokens USING btree (business_id);

-- Table Definition
CREATE TABLE "public"."barcode_scan_logs" (

    "id" int8 NOT NULL DEFAULT nextval('barcode_scan_logs_id_seq'::regclass),
    "delivery_note_item_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "barcode_scanned" varchar(100) NOT NULL,
    "scan_type" varchar(10) NOT NULL,
    "scanned_by" int8 NOT NULL,
    "scanned_at" timestamptz NOT NULL DEFAULT now(),
    "device_info" varchar(255),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."barcode_scan_logs"."scan_type" IS 'Valid values (validated in frontend): OUT, IN';


-- Indices
CREATE INDEX idx_scan_logs_dn_item_id ON public.barcode_scan_logs USING btree (delivery_note_item_id);
CREATE INDEX idx_scan_logs_item_id ON public.barcode_scan_logs USING btree (item_id);
CREATE INDEX idx_scan_logs_scanned_by ON public.barcode_scan_logs USING btree (scanned_by);
CREATE INDEX idx_scan_logs_scan_type_time ON public.barcode_scan_logs USING btree (scan_type, scanned_at DESC);
CREATE INDEX idx_scan_logs_barcode ON public.barcode_scan_logs USING btree (barcode_scanned);
CREATE UNIQUE INDEX uq_scan_logs_one_per_type ON public.barcode_scan_logs USING btree (delivery_note_item_id, scan_type);

-- Table Definition
CREATE TABLE "public"."stock_alerts" (

    "id" int8 NOT NULL DEFAULT nextval('stock_alerts_id_seq'::regclass),
    "item_id" int8 NOT NULL,
    "balance_at_alert" numeric(10,2) NOT NULL,
    "threshold_at_alert" numeric(10,2) NOT NULL,
    "is_resolved" bool NOT NULL DEFAULT false,
    "reference_order_id" int8,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "reference_po_id" int8,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_stock_alerts_item_id ON public.stock_alerts USING btree (item_id);
CREATE INDEX idx_stock_alerts_is_resolved ON public.stock_alerts USING btree (is_resolved) WHERE (is_resolved = false);
CREATE INDEX idx_stock_alerts_reference_order_id ON public.stock_alerts USING btree (reference_order_id);
CREATE UNIQUE INDEX uq_stock_alerts_open_per_item ON public.stock_alerts USING btree (item_id) WHERE (is_resolved = false);
CREATE INDEX idx_stock_alerts_reference_po_id ON public.stock_alerts USING btree (reference_po_id);

-- Table Definition
CREATE TABLE "public"."moka_transaction_items" (

    "uuid" text NOT NULL,
    "transaction_id" text,
    "item_id" int8,
    "item_variant_id" int8,
    "item_name" text,
    "item_variant_name" text,
    "category_name" text,
    "sales_type_name" text,
    "quantity" int4,
    "price" numeric(15,2),
    "gross_sales" numeric(15,2),
    "net_sales" numeric(15,2),
    "cogs" numeric(15,2),
    "sku" text,
    "is_recipe" bool,
    "refunded_quantity" int4,
    PRIMARY KEY ("uuid")
);

-- Table Definition
CREATE TABLE "public"."inventory_logs" (

    "id" int8 NOT NULL DEFAULT nextval('inventory_logs_id_seq'::regclass),
    "item_id" int8 NOT NULL,
    "movement_type" varchar(10) NOT NULL,
    "qty_change" numeric(10,2) NOT NULL,
    "ending_balance" numeric(10,2) NOT NULL,
    "reference_type" varchar(30) NOT NULL,
    "reference_id" int8,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."inventory_logs"."movement_type" IS 'Valid values (validated in frontend): IN, OUT, ADJ';
COMMENT ON COLUMN "public"."inventory_logs"."reference_type" IS 'Valid runtime values: IN→RECEIPT,OB,PURCHASE | OUT→ATOMIC_TRANSFER,PUBLIC_RECEIVE,ISSUE_WRITE_OFF,WRITE_OFF | ADJ→OPNAME_ADJUSTMENT';


-- Indices
CREATE INDEX idx_inventory_logs_item_id ON public.inventory_logs USING btree (item_id);
CREATE INDEX idx_inventory_logs_item_created ON public.inventory_logs USING btree (item_id, created_at DESC);
CREATE INDEX idx_inventory_logs_reference ON public.inventory_logs USING btree (reference_type, reference_id);
CREATE INDEX idx_inventory_logs_movement_type ON public.inventory_logs USING btree (movement_type);
CREATE INDEX idx_inventory_logs_created_at ON public.inventory_logs USING btree (created_at DESC);

-- Table Definition
CREATE TABLE "public"."outlet_item_settings" (

    "id" int8 NOT NULL DEFAULT nextval('outlet_item_settings_id_seq'::regclass),
    "outlet_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "minimum_threshold" numeric(10,2) DEFAULT 0,
    "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX outlet_item_settings_outlet_id_item_id_key ON public.outlet_item_settings USING btree (outlet_id, item_id);
CREATE INDEX idx_outlet_item_settings_outlet_id ON public.outlet_item_settings USING btree (outlet_id);

-- Table Definition
CREATE TABLE "public"."sales_transaction_items" (

    "id" int8 NOT NULL DEFAULT nextval('sales_transaction_items_id_seq'::regclass),
    "sales_transaction_id" int8 NOT NULL,
    "menu_id" int8 NOT NULL,
    "qty" numeric(10,2) NOT NULL DEFAULT 1,
    "unit_price" numeric(15,2) NOT NULL,
    "subtotal" numeric(15,2) NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_sales_tx_items_txid ON public.sales_transaction_items USING btree (sales_transaction_id);
CREATE INDEX idx_sales_tx_items_menu ON public.sales_transaction_items USING btree (menu_id);

-- Table Definition
CREATE TABLE "public"."stock_count_details" (

    "id" int8 NOT NULL DEFAULT nextval('stock_count_details_id_seq'::regclass),
    "header_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "system_balance" numeric(10,2) NOT NULL,
    "actual_physical_qty" numeric(10,2) NOT NULL,
    "variance" numeric(10,2) NOT NULL,
    "reason_category" varchar(20),
    "reason_notes" text,
    "value_amount" numeric(15,2) NOT NULL DEFAULT 0,
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."stock_count_details"."reason_category" IS 'Valid values (validated in frontend): RUSAK, KADALUARSA, SALAH_CATAT, HILANG_SUSUT, LAINNYA';


-- Indices
CREATE UNIQUE INDEX uq_count_item ON public.stock_count_details USING btree (header_id, item_id);
CREATE INDEX idx_count_details_header_id ON public.stock_count_details USING btree (header_id);
CREATE INDEX idx_count_details_item_id ON public.stock_count_details USING btree (item_id);

-- Table Definition
CREATE TABLE "public"."outlet_stocks" (

    "outlet_id" int8 NOT NULL,
    "item_id" int8 NOT NULL,
    "current_balance" numeric(10,2) NOT NULL DEFAULT 0,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("outlet_id","item_id")
);

-- Table Definition
CREATE TABLE "public"."outlet_local_purchase_items" (

    "id" int8 NOT NULL DEFAULT nextval('outlet_local_purchase_items_id_seq'::regclass),
    "purchase_id" int8,
    "item_id" int8,
    "qty" numeric(10,2) NOT NULL,
    "price_per_unit" numeric(15,2) NOT NULL,
    "subtotal" numeric(15,2) NOT NULL,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."purchase_orders" (

    "id" int8 NOT NULL DEFAULT nextval('purchase_orders_id_seq'::regclass),
    "po_number" varchar(100) NOT NULL,
    "vendor_id" int8 NOT NULL,
    "vendor_reference" varchar(255),
    "order_date" date NOT NULL DEFAULT CURRENT_DATE,
    "order_deadline" timestamptz,
    "confirmation_required" bool NOT NULL DEFAULT true,
    "confirmation_days_before" int4,
    "destination_outlet_id" int8,
    "status" varchar(20) NOT NULL DEFAULT 'RFQ'::character varying,
    "payment_terms" varchar(100),
    "incoterm" varchar(100) DEFAULT '— Not set —'::character varying,
    "internal_notes" text,
    "buyer_id" int8 NOT NULL,
    "stock_alert_id" int8,
    "is_favorite" bool NOT NULL DEFAULT false,
    "currency" varchar(10) NOT NULL DEFAULT 'IDR'::character varying,
    "purchase_agreement_id" int8,
    "subtotal" numeric(15,2) NOT NULL DEFAULT 0,
    "total_tax" numeric(15,2) NOT NULL DEFAULT 0,
    "total" numeric(15,2) NOT NULL DEFAULT 0,
    "created_by" int8 NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deliver_to" varchar(255),
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."purchase_orders"."destination_outlet_id" IS 'NULL = default target Central Warehouse: Receiving';
COMMENT ON COLUMN "public"."purchase_orders"."status" IS 'Valid values (validated in frontend): RFQ, RFQ_TERKIRIM, PURCHASE_ORDER, DITERIMA_SEBAGIAN, SELESAI, DIBATALKAN';
COMMENT ON COLUMN "public"."purchase_orders"."purchase_agreement_id" IS '[Open Question] Placeholder, purchase_agreements table does not exist yet -- do not assume it functions as an FK until scope decision is made';


-- Indices
CREATE UNIQUE INDEX purchase_orders_po_number_key ON public.purchase_orders USING btree (po_number);
CREATE INDEX idx_po_vendor_id ON public.purchase_orders USING btree (vendor_id);
CREATE INDEX idx_po_destination_outlet_id ON public.purchase_orders USING btree (destination_outlet_id);
CREATE INDEX idx_po_buyer_id ON public.purchase_orders USING btree (buyer_id);
CREATE INDEX idx_po_created_by ON public.purchase_orders USING btree (created_by);
CREATE INDEX idx_po_stock_alert_id ON public.purchase_orders USING btree (stock_alert_id);
CREATE INDEX idx_po_status ON public.purchase_orders USING btree (status);
CREATE INDEX idx_po_order_date ON public.purchase_orders USING btree (order_date DESC);
CREATE INDEX idx_po_vendor_status ON public.purchase_orders USING btree (vendor_id, status);

-- Table Definition
CREATE TABLE "public"."delivery_note_issues" (

    "id" int8 NOT NULL DEFAULT nextval('delivery_note_issues_id_seq'::regclass),
    "delivery_note_item_id" int8 NOT NULL,
    "qty_issue" numeric(10,2) NOT NULL,
    "reason" varchar(255) NOT NULL,
    "photo_url" varchar(1024) NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'PENDING'::character varying,
    "reported_at" timestamptz NOT NULL DEFAULT now(),
    "resolved_at" timestamptz,
    "resolved_by" int8,
    "resolution_notes" varchar(1024),
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."moka_transactions" (

    "id" text NOT NULL,
    "payment_no" text NOT NULL,
    "outlet_id" int8,
    "outlet_name" text,
    "total_collected" numeric(15,2),
    "payment_type" text,
    "payment_type_label" text,
    "discounts" numeric(15,2),
    "subtotal" numeric(15,2),
    "gratuities" numeric(15,2),
    "taxes" numeric(15,2),
    "tendered" numeric(15,2),
    "change" numeric(15,2),
    "transaction_date" text,
    "transaction_time" text,
    "collected_by" text,
    "served_by" text,
    "is_refunded" bool,
    "order_id" text,
    "moka_created_at" timestamptz,
    "synced_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "change_amount" numeric(15,2),
    "total_refund" numeric(15,2) DEFAULT 0,
    "guid" varchar(36),
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "is_stock_deducted" bool NOT NULL DEFAULT false,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."moka_customers" (

    "id" int8 NOT NULL,
    "business_id" int8,
    "outlet_id" int8,
    "name" varchar(255),
    "email" varchar(255),
    "phone" varchar(50),
    "address" text,
    "city" varchar(100),
    "state" varchar(100),
    "postal_code" varchar(20),
    "birthday" varchar(50),
    "sex" varchar(20),
    "guid" varchar(36),
    "uniq_id" varchar(100),
    "is_deleted" bool DEFAULT false,
    "moka_created_at" timestamptz,
    "moka_updated_at" timestamptz,
    "synchronized_at" timestamptz,
    "synced_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

-- Table Definition
CREATE TABLE "public"."delivery_note_items" (

    "id" int8 NOT NULL DEFAULT nextval('delivery_note_items_id_seq'::regclass),
    "delivery_note_id" int8 NOT NULL,
    "order_item_id" int8,
    "item_id" int8 NOT NULL,
    "qty_shipped" numeric(10,2) NOT NULL,
    "price_at_shipment" numeric(15,2) NOT NULL,
    "scanned_out_at" timestamptz,
    "scanned_out_by" int8,
    "scanned_in_at" timestamptz,
    "scanned_in_by" int8,
    "keterangan" varchar(255),
    "unique_barcode" varchar,
    "qty_received" numeric(10,3),
    "discrepancy_reason" varchar(100),
    "discrepancy_notes" text,
    "receive_notes" text,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX uq_delivery_note_item ON public.delivery_note_items USING btree (delivery_note_id, item_id);
CREATE INDEX idx_dn_items_delivery_note_id ON public.delivery_note_items USING btree (delivery_note_id);
CREATE INDEX idx_dn_items_order_item_id ON public.delivery_note_items USING btree (order_item_id);
CREATE INDEX idx_dn_items_item_id ON public.delivery_note_items USING btree (item_id);
CREATE INDEX idx_dn_items_pending_out ON public.delivery_note_items USING btree (delivery_note_id) WHERE (scanned_out_at IS NULL);
CREATE INDEX idx_dn_items_pending_in ON public.delivery_note_items USING btree (delivery_note_id) WHERE ((scanned_out_at IS NOT NULL) AND (scanned_in_at IS NULL));

-- Table Definition
CREATE TABLE "public"."moka_oauth_states" (

    "state" varchar(36) NOT NULL,
    "client_id" varchar(255) NOT NULL,
    "client_secret" varchar(255) NOT NULL,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("state")
);

-- Table Definition
CREATE TABLE "public"."goods_receipts" (

    "id" int8 NOT NULL DEFAULT nextval('goods_receipts_id_seq'::regclass),
    "purchase_order_id" int8 NOT NULL,
    "receipt_number" varchar(100) NOT NULL,
    "vendor_delivery_note" varchar(100),
    "received_date" timestamptz DEFAULT now(),
    "received_by" int8,
    "status" varchar(20) DEFAULT 'DRAFT'::character varying,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX goods_receipts_receipt_number_key ON public.goods_receipts USING btree (receipt_number);
CREATE INDEX idx_goods_receipts_po_id ON public.goods_receipts USING btree (purchase_order_id);
CREATE INDEX idx_goods_receipts_status ON public.goods_receipts USING btree (status);

-- Table Definition
CREATE TABLE "public"."purchase_order_items" (

    "id" int8 NOT NULL DEFAULT nextval('purchase_order_items_id_seq'::regclass),
    "purchase_order_id" int8 NOT NULL,
    "line_type" varchar(10) NOT NULL DEFAULT 'PRODUK'::character varying,
    "item_id" int8,
    "description" varchar(255),
    "qty" numeric(10,2),
    "package_qty" numeric(10,2),
    "package_unit" varchar(50),
    "unit_price" numeric(15,2),
    "tax_percent" numeric(5,2) NOT NULL DEFAULT 11.00,
    "subtotal" numeric(15,2) NOT NULL DEFAULT 0,
    "sort_order" int4 NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "discount_percent" numeric(5,2) DEFAULT 0,
    "purchase_unit" varchar(50),
    "package_inner_size" numeric,
    "conversion_ratio" numeric,
    PRIMARY KEY ("id")
);

-- Column Comments
COMMENT ON COLUMN "public"."purchase_order_items"."line_type" IS 'Valid values (validated in frontend): PRODUK, BAGIAN, CATATAN';


-- Indices
CREATE INDEX idx_po_items_purchase_order_id ON public.purchase_order_items USING btree (purchase_order_id);
CREATE INDEX idx_po_items_item_id ON public.purchase_order_items USING btree (item_id) WHERE (item_id IS NOT NULL);


-- Foreign keys (added after all tables exist)
ALTER TABLE "public"."items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."items" ADD CONSTRAINT "items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;
ALTER TABLE "public"."items" ADD CONSTRAINT "items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;
ALTER TABLE "public"."outlet_local_purchases" ADD CONSTRAINT "outlet_local_purchases_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE CASCADE;
ALTER TABLE "public"."users" ADD CONSTRAINT "users_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."outlets" ADD CONSTRAINT "outlets_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."stock_count_headers" ADD CONSTRAINT "stock_count_headers_pic_id_fkey" FOREIGN KEY ("pic_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."stock_count_headers" ADD CONSTRAINT "stock_count_headers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id");
ALTER TABLE "public"."delivery_notes" ADD CONSTRAINT "delivery_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."delivery_notes" ADD CONSTRAINT "delivery_notes_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."outlet_menu_prices" ADD CONSTRAINT "outlet_menu_prices_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE CASCADE;
ALTER TABLE "public"."outlet_menu_prices" ADD CONSTRAINT "outlet_menu_prices_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."direct_purchases" ADD CONSTRAINT "direct_purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
ALTER TABLE "public"."direct_purchase_items" ADD CONSTRAINT "direct_purchase_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."items"("id");
ALTER TABLE "public"."direct_purchase_items" ADD CONSTRAINT "direct_purchase_items_direct_purchase_id_fkey" FOREIGN KEY ("direct_purchase_id") REFERENCES "public"."direct_purchases"("id") ON DELETE CASCADE;
ALTER TABLE "public"."direct_purchase_items" ADD CONSTRAINT "direct_purchase_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id");
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."price_history" ADD CONSTRAINT "price_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."price_history" ADD CONSTRAINT "price_history_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;
ALTER TABLE "public"."price_history" ADD CONSTRAINT "price_history_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE SET NULL;
ALTER TABLE "public"."shopping_list_histories" ADD CONSTRAINT "shopping_list_histories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
ALTER TABLE "public"."item_venues" ADD CONSTRAINT "fk_item_venues_item" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."item_venues" ADD CONSTRAINT "fk_item_venues_venue" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;
ALTER TABLE "public"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;
ALTER TABLE "public"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");
ALTER TABLE "public"."recipes" ADD CONSTRAINT "recipes_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");
ALTER TABLE "public"."recipes" ADD CONSTRAINT "recipes_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id");
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;
ALTER TABLE "public"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE CASCADE;
ALTER TABLE "public"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."outlet_inventory_logs" ADD CONSTRAINT "outlet_inventory_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."outlet_inventory_logs" ADD CONSTRAINT "outlet_inventory_logs_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."sales_transactions" ADD CONSTRAINT "sales_transactions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."sales_transactions" ADD CONSTRAINT "sales_transactions_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON UPDATE CASCADE;
ALTER TABLE "public"."outlet_venues" ADD CONSTRAINT "outlet_venues_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;
ALTER TABLE "public"."outlet_venues" ADD CONSTRAINT "outlet_venues_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."moka_item_variants" ADD CONSTRAINT "moka_item_variants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."moka_items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."moka_item_variants" ADD CONSTRAINT "moka_item_variants_internal_recipe_id_fkey" FOREIGN KEY ("internal_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;
ALTER TABLE "public"."barcode_scan_logs" ADD CONSTRAINT "barcode_scan_logs_delivery_note_item_id_fkey" FOREIGN KEY ("delivery_note_item_id") REFERENCES "public"."delivery_note_items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."barcode_scan_logs" ADD CONSTRAINT "barcode_scan_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."barcode_scan_logs" ADD CONSTRAINT "barcode_scan_logs_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."stock_alerts" ADD CONSTRAINT "stock_alerts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."stock_alerts" ADD CONSTRAINT "stock_alerts_reference_order_id_fkey" FOREIGN KEY ("reference_order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;
ALTER TABLE "public"."stock_alerts" ADD CONSTRAINT "stock_alerts_reference_po_id_fkey" FOREIGN KEY ("reference_po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;
ALTER TABLE "public"."moka_transaction_items" ADD CONSTRAINT "moka_transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."moka_transactions"("id") ON DELETE CASCADE;
ALTER TABLE "public"."inventory_logs" ADD CONSTRAINT "inventory_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."outlet_item_settings" ADD CONSTRAINT "outlet_item_settings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."outlet_item_settings" ADD CONSTRAINT "outlet_item_settings_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."sales_transaction_items" ADD CONSTRAINT "sales_transaction_items_sales_transaction_id_fkey" FOREIGN KEY ("sales_transaction_id") REFERENCES "public"."sales_transactions"("id") ON DELETE CASCADE;
ALTER TABLE "public"."sales_transaction_items" ADD CONSTRAINT "sales_transaction_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id");
ALTER TABLE "public"."stock_count_details" ADD CONSTRAINT "stock_count_details_header_id_fkey" FOREIGN KEY ("header_id") REFERENCES "public"."stock_count_headers"("id") ON DELETE CASCADE;
ALTER TABLE "public"."stock_count_details" ADD CONSTRAINT "stock_count_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."outlet_stocks" ADD CONSTRAINT "outlet_stocks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."outlet_stocks" ADD CONSTRAINT "outlet_stocks_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."outlet_local_purchase_items" ADD CONSTRAINT "outlet_local_purchase_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."outlet_local_purchase_items" ADD CONSTRAINT "outlet_local_purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."outlet_local_purchases"("id") ON DELETE CASCADE;
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_stock_alert_id_fkey" FOREIGN KEY ("stock_alert_id") REFERENCES "public"."stock_alerts"("id") ON DELETE SET NULL;
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_destination_outlet_id_fkey" FOREIGN KEY ("destination_outlet_id") REFERENCES "public"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."delivery_note_issues" ADD CONSTRAINT "delivery_note_issues_delivery_note_item_id_fkey" FOREIGN KEY ("delivery_note_item_id") REFERENCES "public"."delivery_note_items"("id") ON DELETE CASCADE;
ALTER TABLE "public"."delivery_note_issues" ADD CONSTRAINT "delivery_note_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE CASCADE;
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_scanned_out_by_fkey" FOREIGN KEY ("scanned_out_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."delivery_note_items" ADD CONSTRAINT "delivery_note_items_scanned_in_by_fkey" FOREIGN KEY ("scanned_in_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id");
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;
