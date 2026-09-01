-- Multi-store: a `stores` table under each Organization, `member_stores`
-- granting people access to them, and a denormalized `store_id` on the
-- transactional tables (customers, orders, order_items). The catalog stays
-- Organization-wide.
--
-- Hand-edited after `drizzle-kit generate` for two reasons Drizzle can't
-- express: (1) the new `store_id` columns are NOT NULL on tables that
-- already hold rows, so they're added nullable, backfilled from a per-org
-- "Main" store, then locked; (2) `stores` needs `FORCE ROW LEVEL SECURITY`
-- (Drizzle only emits ENABLE), and both that and the existing FORCE on
-- customers/orders/order_items have to be off while this migration's own
-- backfill runs as the owner with no app.organization_id set.

CREATE TYPE "public"."store_status" AS ENUM('active', 'suspended');--> statement-breakpoint

CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "store_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "stores" ADD CONSTRAINT "stores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_stores" ADD CONSTRAINT "member_stores_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_stores" ADD CONSTRAINT "member_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stores_organization_id_idx" ON "stores" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_stores_member_store_unique" ON "member_stores" USING btree ("member_id","store_id");--> statement-breakpoint
CREATE INDEX "member_stores_member_id_idx" ON "member_stores" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_stores_store_id_idx" ON "member_stores" USING btree ("store_id");--> statement-breakpoint

-- RLS on `stores`: ENABLE + policy now, FORCE at the very end so the
-- backfill below (run as the table owner) isn't blocked by it.
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "stores" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint

-- One "Main" store per existing Organization, and a grant to every existing
-- member so their next login resolves to it instead of /select-store.
INSERT INTO "stores" ("organization_id", "name")
SELECT "id", 'Main' FROM "organizations";--> statement-breakpoint
INSERT INTO "member_stores" ("member_id", "store_id")
SELECT m."id", s."id"
FROM "members" m
JOIN "stores" s ON s."organization_id" = m."organization_id" AND s."name" = 'Main';--> statement-breakpoint

ALTER TABLE "sessions" ADD COLUMN "active_store_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_store_id_stores_id_fk" FOREIGN KEY ("active_store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- store_id on the transactional tables. FORCE off for the backfill, back on
-- after.
ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "customers" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "store_id" uuid;--> statement-breakpoint

UPDATE "customers" c SET "store_id" = s."id"
FROM "stores" s WHERE s."organization_id" = c."organization_id" AND s."name" = 'Main';--> statement-breakpoint
UPDATE "orders" o SET "store_id" = s."id"
FROM "stores" s WHERE s."organization_id" = o."organization_id" AND s."name" = 'Main';--> statement-breakpoint
UPDATE "order_items" oi SET "store_id" = s."id"
FROM "stores" s WHERE s."organization_id" = oi."organization_id" AND s."name" = 'Main';--> statement-breakpoint

ALTER TABLE "customers" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Index swaps: organization-only leading columns give way to
-- (organization, store, …) now that every list is scoped to one store.
DROP INDEX "customers_organization_name_idx";--> statement-breakpoint
DROP INDEX "orders_organization_created_idx";--> statement-breakpoint
DROP INDEX "order_items_org_product_status_idx";--> statement-breakpoint
DROP INDEX "order_items_org_status_created_idx";--> statement-breakpoint
CREATE INDEX "customers_organization_store_name_idx" ON "customers" USING btree ("organization_id","store_id","name");--> statement-breakpoint
CREATE INDEX "orders_organization_store_created_idx" ON "orders" USING btree ("organization_id","store_id","created_at","id");--> statement-breakpoint
CREATE INDEX "order_items_org_store_product_status_idx" ON "order_items" USING btree ("organization_id","store_id","product_id","status");--> statement-breakpoint
CREATE INDEX "order_items_org_store_status_created_idx" ON "order_items" USING btree ("organization_id","store_id","status","created_at");--> statement-breakpoint

ALTER TABLE "stores" FORCE ROW LEVEL SECURITY;
