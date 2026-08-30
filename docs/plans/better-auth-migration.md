# better-auth migration plan

**Status:** Ready for review — nothing executed
**Last updated:** 2026-08-30
**Related:** [ADR-0002](../adr/0002-multi-tenancy-mvp.md), [better-auth-spike.md](../research/better-auth-spike.md)

Executes the decisions in ADR-0002: identity split from membership, active
Organization on the session, one-at-a-time switching, suspension enforcement,
and support impersonation.

## 1. Risk posture: verified low, but time-sensitive

**As of 2026-08-30 the database holds seed data only** — one Organization
(`Test Organization`) and two users, `cs@test.local` and
`supplier@test.local`. Verified directly against Neon `main`, the only
branch of the only `mini-pos` project. No external client has been
onboarded.

That makes this migration close to risk-free *today*: no maintenance window,
nobody to notify, and a worst-case recovery of re-running the seed script.
Two checks in §2 and the rollback plan in §9 are sized accordingly.

**This expires the moment a real Organization is onboarded.** If a client
lands before this migration runs, restore the full caution: rehearse on a
Neon branch, schedule outside working hours, notify them, and treat §4 step
7 as irreversible. Re-verify the row counts before starting rather than
trusting this paragraph.

### The one consequence that survives either way

**Every existing session is invalidated. Everyone signs in again, once.**
`sessions.token_hash` holds only a SHA-256 hash; better-auth looks sessions
up by the raw token (see
[the spike, §2](../research/better-auth-spike.md)). A hash cannot be turned
back into the token it came from, so existing sessions cannot be carried
over. This is a one-time re-login, *not* a password reset — passwords
survive intact (§4, step 5).

With only seeded test accounts in place this costs nothing. With real users
it costs one re-login each, and wants scheduling.

**Passwords survive because argon2 is preserved.** `src/lib/auth/hash.ts`
becomes better-auth's `emailAndPassword.password.hash` / `verify`, and the
existing hashes move to `account.password` unchanged. No user is ever
prompted to reset.

## 2. Phase 0 — Prerequisites

No application code. Items 1 and 3 are **done**; item 2 is not.

1. ~~**Rehearse on a Neon branch.**~~ Verified 2026-08-30: `app_user` has
   `rolbypassrls = false`, so RLS is genuinely enforced; migration `0005` is
   already applied to the database despite being uncommitted in git; and the
   data is seed-only (§1). With nothing to lose, a rehearsal branch is
   optional — but create one (`neon branches create`) if any real
   Organization exists by the time this runs.
2. **Confirm `app_user` can reach the new tables.** Still outstanding, and
   this will break the app silently if skipped. The role was granted with
   `grant select, insert, update, delete on all tables in schema public`,
   which applies only to tables that existed *at that moment*. The four new
   tables need their own grant:

   ```sql
   grant select, insert, update, delete
     on account, verification, member, invitation
     to app_user;
   -- and so this stops being a recurring trap:
   alter default privileges in schema public
     grant select, insert, update, delete on tables to app_user;
   ```

   Remember that `app_user` must keep its non-`BYPASSRLS` property — never
   recreate it through the Neon console or CLI
   ([TECH_STACK.md](../TECH_STACK.md#neon-role-setup-app_user-vs-the-owner-role)).
3. ~~**Confirm the plan for `users.role`.**~~ Approved 2026-08-30; see §3.

Scale of the backfill, measured: 1 Organization, 2 users, 182 sessions (all
disposable), 10 customers, 17 orders.

## 3. The `users.role` collision

`users.role` currently holds `customer_service | supplier` as a Postgres
enum. Two different things now want that column name:

- **`member.role`** — the functional role within an Organization. Per
  ADR-0002 this is where it belongs, since a person can be Customer Service
  at one Organization and Supplier at another.
- **`user.role`** — what better-auth's *admin* plugin adds, meaning
  platform-level administrator. That is us, the operator, not a tenant role.

They are genuinely different axes and both are wanted. The resolution:

- Drop the existing `users.role` enum column; its values move to
  `member.role`.
- Let the admin plugin own `user.role` as platform-level.
- Store `member.role` as **text**, not the `user_role` enum — better-auth
  writes comma-separated values for multi-role members, which an enum cannot
  hold. Keep the TypeScript union for `roleLabel()` so the compile-time
  safety in `src/lib/auth/index.ts` survives; retire the `user_role` pg enum
  once nothing references it.
- For MVP, authorise admins via the plugin's `adminUserIds` allowlist rather
  than populating `user.role`. Fewer moving parts, and no in-app path to
  granting yourself platform admin.

## 4. Phase 1 — Schema and data migration

One migration, run in this order. Each step is reversible up to step 7.

1. **`organizations`** — add `slug` nullable, backfill a slugified unique
   value from `name`, add the unique index, set `not null`. Add `logo` and
   `metadata` if the plugin requires them. `status` stays and is declared as
   an `additionalFields` entry.
2. **Create `account`, `verification`, `member`, `invitation`.**
3. **`users`** — add `email_verified` (boolean, default false), `image`,
   `updated_at`. Add the admin plugin's `banned` / `ban_reason` /
   `ban_expires`.
4. **Backfill `member`** from `users.organization_id` + `users.role`, one row
   per existing user. Verify: `count(member) == count(users)`.
5. **Backfill `account`** — one row per user with `providerId`
   `local:credential`, `accountId` = the user id, and `password` = the
   existing `users.password_hash`, copied verbatim. Verify:
   `count(account) == count(users)`, and that no `password` is null.
6. **Rebuild `sessions`** to better-auth's shape: `token` (unique),
   `ip_address`, `user_agent`, `updated_at`, plus `active_organization_id`
   from the organization plugin and `impersonated_by` from the admin plugin.
   Existing rows are unusable (§1), so truncate rather than attempt a
   conversion.
7. **Drop `users.organization_id`, `users.role`, `users.password_hash`.**
   This is the point of no return; everything before it is additive.
8. **RLS.** `member`, `account` and `verification` stay **outside** RLS,
   alongside `users` and `sessions` — each is read in order to establish the
   tenant scope, so none can be gated on it. `invitation` is tenant-scoped
   but is also read pre-auth when accepting; since invitations are deferred
   from MVP, leave the table empty and unpoliced, and settle this when the
   feature is built.
9. **Grants**, per §2.2.

`src/db/schema.ts` is hand-maintained and carries the reasoning comments
that make it readable. Run better-auth's schema generator, then reconcile
its output into `schema.ts` **by hand** — do not let it overwrite the file.

## 5. Phase 2 — Configuration

`src/lib/auth/config.ts`, the single better-auth instance:

- Drizzle adapter over the existing `db`.
- `modelName` mappings: `user` → `users`, `session` → `sessions`,
  `organization` → `organizations`.
- `emailAndPassword.password.hash` / `verify` wired to the existing argon2
  functions in `hash.ts`.
- `session.cookieCache: { enabled: true, maxAge: 300 }` — five minutes.
  This is what removes the per-request database round-trip, and it is also
  why suspension takes up to five minutes to bite (§6).
- `organization` plugin: `additionalFields` for `organizations.status`,
  custom roles via `createAccessControl` for `customer_service` and
  `supplier`.
- `admin` plugin: `adminUserIds` allowlist, `impersonationSessionDuration`
  set deliberately (default is one hour).

## 6. Phase 3 — Rewire the application

The goal is that **feature code does not change**. `organizationId` is read
in exactly one place outside the db layer (`src/lib/tenancy.ts:4`), and
`role` only ever as `user.role` off `requireUser()` — ten call sites. Keep
both shapes and none of them move.

1. **`src/lib/auth/index.ts`** — `requireUser()` returns the same shape it
   returns today (`id`, `name`, `email`, `organizationId`, `role`), now
   sourced from the better-auth session plus a `member` lookup. Role is
   resolved by join, not denormalised onto the session, so a role change
   takes effect immediately.
2. **`src/lib/tenancy.ts`** — reads `session.activeOrganizationId`.
   Signature unchanged, so no feature code moves.
3. **`src/lib/auth/session.ts`** — deleted; better-auth replaces it.
   `hash.ts` stays, now feeding the config.
4. **`src/proxy.ts`** — update `SESSION_COOKIE_NAME`; better-auth's cookie is
   `better-auth.session_token`. The stale-cookie redirect-loop reasoning in
   that file still applies and should be preserved.
5. **Login and logout** — the form action calls better-auth's sign-in rather
   than the hand-rolled `login()`.

**Invariant to hold from here on:** feature code never imports better-auth
directly. It calls `requireUser()` and `withCurrentOrganization()`. This is
what keeps a future swap — to Cognito, or anything else — a two-file change
instead of a rewrite.

## 7. Phase 4 — New capability

1. **Suspension.** An Organization with `status = 'suspended'` resolves to no
   session. Takes effect within `cookieCache.maxAge`.
2. **Org switcher.** In Settings: list the user's memberships, tap to switch
   via `organization.setActive()`, redirect to `/`. For a single-membership
   user the section is hidden entirely.
3. **Impersonation.** `admin.impersonateUser` / `stopImpersonating`, with
   the acting admin recorded in `session.impersonatedBy`. Two requirements
   beyond the plugin defaults:
   - **A persistent audit record.** `impersonatedBy` lives on a session row
     that is deleted when impersonation ends. Write an append-only row —
     who impersonated whom, when, and for how long — that outlives it. You
     are looking at another company's customer data; that should leave a
     trace you cannot quietly remove.
   - **A visible banner** for the whole impersonated session, so nobody
     mistakes a client's account for their own and writes to it.

## 8. Phase 5 — Safety net

1. **Test runner.** Add vitest. There is currently no test infrastructure.
2. **Cross-org isolation test**, per ADR-0002 §9. Two Organizations with
   real fixtures, asserting:
   - a scope on A cannot read B's rows *through a query that omits its own
     `organization_id` filter* — this is the RLS layer, and it is the one
     that catches a missed `where`;
   - a Supplier who is a member of both, stamped to A, sees only A;
   - an impersonated session is scoped to the impersonated user's
     Organization, not the admin's.
3. **Provisioning scripts.** Replace `seed-test-users.mts` with
   `create-organization.mts` (Organization + first member) and
   `add-membership.mts` (existing user → another Organization). The second
   is what makes a shared Supplier work, and it is the first thing to run
   after migrating.

## 9. Rollback

Up to §4 step 7 every change is additive and can be reverted by dropping the
new tables and columns. After step 7, rollback is a Neon instant restore to
the pre-migration point — which loses any writes made since.

**While the data is seed-only (§1), rollback is simply re-running the seed
script**, and none of the above needs to be careful. Once a real
Organization exists, revert to the stricter reading: rehearse the whole
sequence on a Neon branch, confirm correct row counts at steps 4 and 5,
and do not linger between steps 6 and 8.

## 10. Verification checklist

- [ ] Both Organizations' users can sign in with their **existing**
      passwords.
- [ ] `count(member)` and `count(account)` each equal the pre-migration
      `count(users)`.
- [ ] A Supplier added to both Organizations sees only one queue, and
      switching changes it.
- [ ] Suspending an Organization locks its staff out within five minutes.
- [ ] Impersonation shows a banner, and leaves an audit row that survives
      `stopImpersonating`.
- [ ] The isolation test passes, and fails when the RLS policy is
      deliberately dropped — a test that cannot fail is not a test.
- [ ] `app_user` still cannot bypass RLS.
