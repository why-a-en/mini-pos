// Schema mirrors docs/DATA_MODEL.md — keep both in sync when this changes.
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- Enums ---------------------------------------------------------------

export const vendorStatusEnum = pgEnum("vendor_status", ["active", "suspended"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "customer_service", "supplier"]);
export const productStatusEnum = pgEnum("product_status", ["active", "archived"]);
export const sourceMarketplaceEnum = pgEnum("source_marketplace", [
  "lazada",
  "tiktok_shop",
  "other",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "purchased",
  "cancelled",
]);

// --- Tables ----------------------------------------------------------------

// The tenant. One row per business using the platform (just one for now).
// See docs/TECH_STACK.md §4 for why every other table below carries a
// vendor_id from day one.
export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: vendorStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Staff accounts. Auth is self-rolled for now (docs/TECH_STACK.md §2) —
// email/password_hash are kept plain and portable so migrating to a managed
// auth provider later is a data mapping, not a schema rewrite.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("users_vendor_id_idx").on(table.vendorId),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

// Backs the self-rolled auth session cookie. A row per active login;
// deleting a row (or letting it expire) logs that session out.
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

// The catalog entry — created once by Customer Service, reused across orders.
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    sourceMarketplace: sourceMarketplaceEnum("source_marketplace"),
    // The highest-leverage field — see docs/PRD.md §9.1: lets the Supplier skip
    // manual image search entirely when populated.
    sourceUrl: text("source_url"),
    // Shape: [{ name: "Color", options: ["Black", "White"] }, ...]; [] if none.
    modifiers: jsonb("modifiers").notNull().default([]),
    price: numeric("price", { precision: 12, scale: 2 }),
    status: productStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_vendor_status_idx").on(table.vendorId, table.status),
    index("products_vendor_name_idx").on(table.vendorId, table.name),
  ],
);

// One-to-many, separate table (rather than an array column) so images can be
// ordered and a primary image is unambiguous.
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Denormalized from products.vendorId — see docs/DATA_MODEL.md §4.
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("product_images_product_sort_idx").on(table.productId, table.sortOrder)],
);

// A single customer's request, logged by Customer Service against an existing
// product (per the locked MVP decision — no ad-hoc orders yet).
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Denormalized from products.vendorId — see docs/DATA_MODEL.md §4.
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    customerName: text("customer_name").notNull(),
    customerContact: text("customer_contact"),
    // Shape: { "Color": "Black", "Size": "M" }
    selectedModifiers: jsonb("selected_modifiers").notNull().default({}),
    quantity: integer("quantity").notNull().default(1),
    screenshotUrl: text("screenshot_url"),
    notes: text("notes"),
    status: orderStatusEnum("status").notNull().default("pending"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
  },
  (table) => [
    // Powers the Supplier's "Today's Pending Orders" view.
    index("orders_vendor_status_created_idx").on(table.vendorId, table.status, table.createdAt),
    // Powers grouping pending orders by product with a running quantity total.
    index("orders_vendor_product_status_idx").on(table.vendorId, table.productId, table.status),
  ],
);
