import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — see .env.example");
}

// Deliberately the WebSocket-based Pool driver (drizzle-orm/neon-serverless),
// not the stateless HTTP driver (drizzle-orm/neon-http): withOrganizationScope
// below needs a real transaction so `set_config` actually applies to the
// queries that follow it. The HTTP driver issues each query as an
// independent request, so a session-scoped setting wouldn't stick. Requires
// Node's runtime (global WebSocket, available on Node 22+) — keep DB access
// out of the edge runtime.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export type Db = typeof db;

/**
 * Every request that touches tenant-scoped tables must go through this.
 *
 * Runs `fn` inside a transaction with the Postgres session variable the RLS
 * policies in docs/DATA_MODEL.md §5 check (`app.organization_id`) set
 * first. This is defense-in-depth, not the only guard — queries inside
 * `fn` should *also* explicitly filter by organizationId (see
 * docs/DATA_MODEL.md §4 for why it's denormalized onto every table). A bug
 * that skips this call is caught by RLS; a bug that skips the explicit
 * filter is caught by this.
 */
export async function withOrganizationScope<T>(
  organizationId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);
    return fn(tx as unknown as Db);
  });
}
