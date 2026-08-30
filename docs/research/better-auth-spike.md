# better-auth: adoption spike

**Status:** Complete
**Last updated:** 2026-08-30
**Related:** [myanmar-compliance.md](./myanmar-compliance.md), [TECH_STACK.md](../TECH_STACK.md), [ADR-0002](../adr/0002-multi-tenancy-mvp.md)

Three questions were blocking a decision to replace the self-rolled auth in
`src/lib/auth/` with [better-auth](https://better-auth.com) and its
organization plugin. Two came back clean; one is a real trade-off we are
accepting knowingly. Scalability and framework portability were added to the
spike because a future move off Next.js is on the table — see
[ARCHITECTURE_ROADMAP.md](../ARCHITECTURE_ROADMAP.md).

**Verdict: adopt.** The structural questions (Q2, Q3) passed, the security
trade (Q1) is marginal in our threat model, and portability is a decisive
argument in favour.

## 1. Why this library and not a managed provider

The [compliance research](./myanmar-compliance.md) found no legal barrier to
using a managed auth provider from Myanmar — sanctions are targeted, not a
comprehensive embargo, and no provider checked names Myanmar in its terms.
So this is an engineering choice, not a forced one.

better-auth is MIT-licensed and self-hosted. There is no counterparty, no
account to open, and no eligibility question — it sits in the "N/A, no
vendor" row of the compliance provider table. It keeps the property that
made self-rolling attractive while removing the reason self-rolling was
painful.

## 2. Q1 — Session token storage: **fails**

**better-auth stores session tokens in the database in plaintext.**

Confirmed in source rather than docs. In
`packages/better-auth/src/db/internal-adapter.ts`, `createSession` generates
`token: generateId(32)` and passes it unmodified to the row insert;
`findSession` then queries `where field: "token", value: token`. There is no
hash on write and none on read — the stored value *is* the cookie value.
The [session management docs](https://better-auth.com/docs/concepts/session-management)
say as much indirectly: "The session token. Which is also used as the
session cookie."

This is a downgrade from what `src/lib/auth/session.ts` does today, where
only a SHA-256 hash is persisted and the raw token exists nowhere on our
servers. It is not fixable with `databaseHooks` — hashing on write would
break the plaintext lookup on read.

### Why we are accepting it

The `sessions` table cannot be RLS-protected (it is read to *establish* the
tenant scope, so it can't be gated on it — same reason `users` and the new
`member` table sit outside RLS). Anyone with read access to `sessions` also
has read access to `customers`: real names, phone numbers and delivery
addresses for every tenant. An attacker who can steal session tokens can
already read the data those tokens would grant access to. The marginal loss
is small.

Mitigations available if the calculus changes:

- Shorten session lifetime (`session.expiresIn`; default is 7 days).
- Move sessions to `secondaryStorage` (Redis) so they leave Postgres
  entirely — see §5.

## 3. Q2 — Custom columns on plugin-owned tables: **passes**

This was the question with the most structural risk. Every tenant-scoped
table in `src/db/schema.ts` has an FK to `organizations`, and
`organizations.status` drives suspension. If the plugin owned that table
rigidly, our whole schema would hang off something we couldn't extend.

Both halves work. From the
[organization plugin docs](https://better-auth.com/docs/plugins/organization):

```ts
organization({
  schema: {
    organization: {
      modelName: "organizations",
      additionalFields: {
        status: { type: "string", input: false },
      },
    },
  },
})
```

`additionalFields` is supported on `organization`, `member`, `invitation`
and `team`; `modelName` maps a plugin table onto our existing name. Extra
fields are automatically accepted and returned by the plugin's own
endpoints.

## 4. Q3 — Role semantics: **passes**

The plugin ships `owner` / `admin` / `member` by default. Those describe
*managing an organization*; ours (`customer_service`, `supplier`) describe
*what you do in the app*. Different axes, and we only need ours.

Roles are stored as plain strings on the `member` table (comma-separated
when a user holds several), and the defaults can be replaced wholesale with
`createAccessControl`:

```ts
const ac = createAccessControl(statement);
const supplier = ac.newRole({ /* ... */ });

organization({ ac, roles: { supplier, customer_service } })
```

So `userRoleEnum`'s values carry over. If an org-management axis is ever
needed (an Owner who can invite staff), it can be added alongside rather
than instead.

## 5. Scalability

Adopting this is a net performance *win* for our deployment, for one
specific reason: `session.cookieCache` stores session data in a signed,
short-lived cookie, so most requests never reach the database.

```ts
session: { cookieCache: { enabled: true, maxAge: 5 * 60 } }
```

Today `getSessionUser()` makes a Postgres round-trip on every single
request — from Vercel `sin1`, to Neon `ap-southeast-1`, for a user on a
Myanmar mobile network. Removing that from the hot path matters more here
than it would for a desktop app on a fast connection.

**The consequence to plan for:** with cookie caching on, revocation is not
instant. A session stays valid until the cache expires. This directly
affects the organization-suspension check — a suspended tenant's staff keep
working for up to `maxAge`. At five minutes that is acceptable; it needs to
be a deliberate choice rather than a surprise.

Other capabilities, from the
[performance guide](https://better-auth.com/docs/guides/optimizing-for-performance)
and [database docs](https://better-auth.com/docs/concepts/database):

- `secondaryStorage` (Redis, via `@better-auth/redis-storage`) for sessions,
  verification records and rate-limit counters.
- Built-in rate limiting across all routes, stricter on sensitive ones.
- `ctx.context.runInBackground` for deferring non-critical work on
  serverless.
- A documented index list that already covers what we need: `members` on
  `userId` and `organizationId`, `organizations` on `slug`, `sessions` on
  `userId` and `token`.

## 6. Framework portability

The strongest argument in favour, given that a move off Next.js is a live
possibility.

**Backend frameworks with official integrations:** Hono, Fastify, Express,
Elysia, NestJS, Nitro, Encore, Convex.

**Full-stack frameworks:** Next.js, Nuxt, SvelteKit, TanStack Start, React
Router v7, Astro, SolidStart, Waku, Electron.

**Mobile:** Expo, Lynx.

**Databases and ORMs:** PostgreSQL, MySQL, SQLite, MSSQL, via Drizzle,
Prisma, Kysely, or MongoDB.

The core is framework-agnostic; the integrations are thin handler mounts.

Compare that to what we have. The current auth is welded to Next.js:
`cookies()` from `next/headers` in `session.ts`, `redirect()` from
`next/navigation` in `requireUser()`, and login as a Server Action. Moving
to a dedicated backend today would mean rewriting all of it *and* migrating
live sessions. After adopting better-auth, that same move is swapping one
integration import.

## 7. Migration notes

- **Keep argon2.** `emailAndPassword.password.hash` / `verify` accept custom
  functions, so `src/lib/auth/hash.ts` plugs straight in and the two live
  organizations' users never see a forced password reset. (better-auth's own
  default is `scrypt`.)
- **RLS integration is ours.** better-auth knows nothing about
  `app.organization_id` or `withOrganizationScope()`. We read
  `session.activeOrganizationId` and feed it into the existing wrapper;
  `src/lib/tenancy.ts`'s signature does not change. The automated cross-org
  isolation test becomes *more* important after adoption, not less, because
  more of the tenant boundary now runs through code we did not write.
- **`member` sits outside RLS**, alongside `users` and `sessions`, for the
  same reason: it is read to determine the scope.

## Sources

- [Organization plugin](https://better-auth.com/docs/plugins/organization)
- [Database & adapters](https://better-auth.com/docs/concepts/database)
- [Session management](https://better-auth.com/docs/concepts/session-management)
- [Security reference](https://better-auth.com/docs/reference/security)
- [Optimizing for performance](https://better-auth.com/docs/guides/optimizing-for-performance)
- Source: `packages/better-auth/src/db/internal-adapter.ts` in
  [better-auth/better-auth](https://github.com/better-auth/better-auth)
