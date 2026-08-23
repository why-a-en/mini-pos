// Schema mirrors docs/DATA_MODEL.md — keep both in sync when this changes.
import {
  pgTable,
  pgEnum,
  pgPolicy,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Enums ---------------------------------------------------------------

export const organizationStatusEnum = pgEnum("organization_status", ["active", "suspended"]);
export const userRoleEnum = pgEnum("user_role", ["customer_service", "supplier"]);
export const productStatusEnum = pgEnum("product_status", ["active", "archived"]);
// See docs/adr/0001-order-item-lifecycle-and-packing.md for why this has
// five stages, not three, and why cancelled is reachable from all of them.
export const orderItemStatusEnum = pgEnum("order_item_status", [
  "pending",
  "purchased",
  "received",
  "packed",
  "completed",
  "cancelled",
]);

// RLS defense-in-depth (docs/DATA_MODEL.md §5): every tenant-scoped table
// gets this same policy. withCheck is intentionally omitted — Postgres
// falls back to using USING for INSERT/UPDATE checks too when WITH CHECK
// isn't given, so this one expression covers reads and writes.
//
// Every table using this also needs `ALTER TABLE ... FORCE ROW LEVEL
// SECURITY` added by hand to its migration — Drizzle's .enableRLS() only
// emits plain ENABLE, and Postgres exempts a table's *owner* from RLS
// unless FORCE is set too. Our app connects as the owning role, so
// without FORCE these policies would silently do nothing.
const tenantIsolationPolicy = () =>
  pgPolicy("tenant_isolation", {
    using: sql`organization_id = current_setting('app.organization_id')::uuid`,
  });

// --- Tables ----------------------------------------------------------------

// The tenant. One row per business using the platform (just one for now).
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: organizationStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Staff accounts. Auth is self-rolled (docs/TECH_STACK.md §2). No `admin`
// role — new accounts are created by script, not an in-app screen
// (docs/PRD.md §4).
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("users_organization_id_idx").on(table.organizationId),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

// Backs the self-rolled auth session cookie.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

// A real, searchable entity (docs/PRD.md §5.3) — not free text on the
// order. Created inline while logging an order (search-or-create).
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    // Nullable at the DB level even though the create-customer form
    // requires it (docs/PRD.md §5.3) — a handful of test customers
    // predate this field. Every customer created going forward will have
    // one; this just avoids inventing a fake backfill value for the ones
    // that don't.
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("customers_organization_name_idx").on(table.organizationId, table.name),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// The catalog entry — created once by Customer Service, reused across
// order items. The `modifiers` JSONB column from the first schema draft is
// gone — modifiers are now relational, see below.
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    // The highest-leverage field — see docs/PRD.md §9.1: lets the Supplier
    // skip manual image search entirely when populated. No separate
    // "source marketplace" field — the URL alone is enough.
    sourceUrl: text("source_url"),
    price: numeric("price", { precision: 12, scale: 2 }),
    status: productStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_organization_status_idx").on(table.organizationId, table.status),
    index("products_organization_name_idx").on(table.organizationId, table.name),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// One-to-many, separate table (rather than an array column) so images can
// be ordered and a primary image is unambiguous.
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("product_images_product_sort_idx").on(table.productId, table.sortOrder),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// An organization-wide, reusable attribute type (e.g. "Color") — not typed
// fresh per product. See docs/PRD.md §5.2 / docs/CONTEXT.md.
export const modifiers = pgTable(
  "modifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("modifiers_organization_name_unique").on(table.organizationId, table.name),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// One value within a Modifier (e.g. "Black" within "Color") — the global
// list. A product picks a subset; see productModifierOptions below.
export const modifierOptions = pgTable(
  "modifier_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    modifierId: uuid("modifier_id")
      .notNull()
      .references(() => modifiers.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("modifier_options_modifier_value_unique").on(table.modifierId, table.value),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// Join table: which of a Modifier's global Options actually apply to a
// given Product. Which *Modifiers* a product uses is derivable by joining
// through this table — no separate product<->modifier table needed.
export const productModifierOptions = pgTable(
  "product_modifier_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    modifierOptionId: uuid("modifier_option_id")
      .notNull()
      .references(() => modifierOptions.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("product_modifier_options_unique").on(table.productId, table.modifierOptionId),
    index("product_modifier_options_product_idx").on(table.productId),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// A customer's request, logged by Customer Service — a header only. No
// status of its own; see orderItems and
// docs/adr/0001-order-item-lifecycle-and-packing.md for why.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    screenshotUrl: text("screenshot_url"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("orders_organization_customer_idx").on(table.organizationId, table.customerId),
    index("orders_organization_created_idx").on(table.organizationId, table.createdAt),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// One line of an order — a product + a modifier-option combination (see
// orderItemModifiers) + quantity. Carries its OWN status, independently of
// every other item on the same order: the Supplier's Purchase Queue
// batches items by product across many different orders/customers at
// once, not by whole order, so status can't live on `orders`.
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
    status: orderItemStatusEnum("status").notNull().default("pending"),
    cancellationReason: text("cancellation_reason"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Powers the Purchase Queue: group pending items by product across
    // every order/customer.
    index("order_items_org_product_status_idx").on(
      table.organizationId,
      table.productId,
      table.status,
    ),
    // Powers the Packing Queue and general order-log filtering.
    index("order_items_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("order_items_org_order_idx").on(table.organizationId, table.orderId),
    tenantIsolationPolicy(),
  ],
).enableRLS();

// Join table: which Modifier Option(s) were selected for this line — e.g.
// Color=Black *and* Size=M on the same item.
export const orderItemModifiers = pgTable(
  "order_item_modifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    modifierOptionId: uuid("modifier_option_id")
      .notNull()
      .references(() => modifierOptions.id),
  },
  (table) => [
    uniqueIndex("order_item_modifiers_unique").on(table.orderItemId, table.modifierOptionId),
    index("order_item_modifiers_item_idx").on(table.orderItemId),
    tenantIsolationPolicy(),
  ],
).enableRLS();
