import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { admin } from "better-auth/plugins/admin";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "./hash";

// The single better-auth instance. See docs/plans/better-auth-migration.md
// and docs/adr/0002-multi-tenancy-mvp.md for why this replaced the
// self-rolled auth in this directory.
//
// Feature code must never import this file. It calls requireUser() /
// withCurrentOrganization() instead — that indirection is what keeps a
// future swap (to Cognito, or anything else) a two-file change rather than
// a rewrite. See ARCHITECTURE_ROADMAP.md §1.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,

  // usePlural covers every table name at once — our schema exports `users`,
  // `sessions`, `organizations`, `accounts`, `members`, `invitations` and
  // `verifications`, which are exactly better-auth's singular model names
  // pluralised. No per-model `modelName` mapping needed.
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),

  advanced: {
    database: {
      // better-auth's own default emits text ids. Ours are `uuid` columns
      // everywhere, referenced by every tenant table's organization_id and
      // by products.created_by / orders.created_by — and the RLS policies
      // cast `current_setting('app.organization_id')::uuid`. Generating
      // UUIDs keeps all of that working untouched, instead of converting
      // every key and policy in the schema to text.
      generateId: "uuid",
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Stamp the active Organization at sign-in. Without this a new
        // session carries a null activeOrganizationId, getCurrentUser()
        // resolves to null, and the app bounces straight back to /login.
        //
        // Picking the oldest membership is arbitrary but deterministic; a
        // user in more than one Organization changes it with the switcher.
        before: async (session) => {
          const [membership] = await db
            .select({ organizationId: schema.members.organizationId })
            .from(schema.members)
            .where(eq(schema.members.userId, session.userId))
            .orderBy(schema.members.createdAt)
            .limit(1);

          return {
            data: { ...session, activeOrganizationId: membership?.organizationId ?? null },
          };
        },
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    // One place for the rule, rather than each caller inventing its own.
    minPasswordLength: 8,
    // Keeps the existing argon2 hashes working, so migrating users never see
    // a forced password reset. better-auth's own default is scrypt; ours
    // stays argon2id (hash.ts) and the stored hashes move across verbatim.
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },

  session: {
    // Removes the per-request Postgres round-trip that getSessionUser() used
    // to make on every single request — the single biggest latency win in
    // this migration for a user on a Myanmar mobile network.
    //
    // The cost: revocation is not instant. A suspended Organization's staff
    // keep working until this expires. Five minutes is the deliberate
    // trade-off, not a default we inherited.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  plugins: [
    organization({
      schema: {
        organization: {
          additionalFields: {
            // Pre-dates better-auth; drives suspension. `input: false` keeps
            // it out of the plugin's own create/update payloads — status is
            // ours to set, not something an org admin can send.
            status: { type: "string", input: false },
          },
        },
      },
    }),

    // Platform-level administration, which is us — not a tenant role. The
    // functional roles (support_agent / supplier) live on `members`.
    // Two separate axes; see the migration plan §3.
    admin({
      // Allowlist rather than a populated user.role column: fewer moving
      // parts, and no in-app path to granting yourself platform admin.
      adminUserIds: (process.env.PLATFORM_ADMIN_USER_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    }),

    // Must stay last — it flushes Set-Cookie headers from Server Actions.
    nextCookies(),
  ],
});
