# Architecture Roadmap

**Status:** Draft v2
**Last updated:** 2026-08-30
**Related:** [TECH_STACK.md](./TECH_STACK.md), [ADR-0002](./adr/0002-multi-tenancy-mvp.md), [better-auth-spike.md](./research/better-auth-spike.md), [myanmar-compliance.md](./research/myanmar-compliance.md)

This document exists to answer one worry: *the data will already be there
when we need to change the architecture, and that will make it hard.*

It is a real worry, and the answer is not to guess the final architecture
now. It is to make sure the part that is genuinely hard to move — the data —
never has to.

## 1. The fixed point

**Postgres is the system of record, and it does not migrate.**

Every stage below changes what sits *in front of* the database. None of them
change the database. Neon stays, the Drizzle schema stays, the migration
history stays, RLS stays. A framework migration is then a rewrite of the
transport layer, done incrementally, with the data untouched throughout.

This only holds if we refuse a specific class of decision. The following
would each break it, and none should be adopted:

- **A backend-as-a-service that owns the data** — Convex, Firebase, or
  Supabase used as a platform rather than as hosted Postgres. Leaving these
  *is* a data migration.
- **Business logic in the database** — triggers and stored procedures that
  encode rules. Portable in theory, miserable in practice.
- **Auth that stores identity outside our Postgres.** This is one of the
  reasons [ADR-0002](./adr/0002-multi-tenancy-mvp.md) chose a self-hosted
  library over a managed provider: `user`, `session` and `member` are our
  tables, in our database, under our migrations.
- **Business logic reachable only through framework primitives.** Rules that
  live inside Server Actions are rules that cannot be called by an HTTP
  handler, a mobile client, a scheduled job, or a test. This is the one we
  are currently guilty of — see Stage 1.

## 2. Where we are, and what it can actually take

Stage 0 today: Next.js 16 on Vercel (`sin1`), Neon Postgres
(`ap-southeast-1`), Drizzle, React Server Components for reads, Server
Actions for writes, self-rolled auth. Two live Organizations.

The region choice is already right — both compute and database sit in
Singapore, which is about as close to Myanmar as either provider goes. That
removes the single largest latency lever before it needs pulling.

**On capacity, the arithmetic is not close.** An order-logging tool for a
resale business is a low-write workload: a Customer Service agent logs
orders at human typing speed, and a Supplier clears a queue in batches.
Fifty Organizations each logging two hundred orders a day is ten thousand
writes a day — well under one write per second sustained, against a Postgres
instance that would handle three orders of magnitude more without
attention. Reads are indexed and tenant-scoped by construction.

The honest conclusion: **we are nowhere near a throughput limit, and adding
customers will not put us near one.** If this architecture is ever replaced,
it will be for a capability we cannot get here — not because it ran out of
room. §5 sets the measurements that would prove this wrong.

## 3. The real risks at this stage

None of these are throughput, and none need an architecture change.

1. **Neon scale-to-zero cold starts.** After an idle period the first
   request pays compute resume time. For a user on a Myanmar mobile network
   this is the most visible performance problem we have. Fixed by autosuspend
   configuration, not by architecture.
2. **A database round-trip per request for session resolution.**
   `getSessionUser()` currently hits Postgres on every request. better-auth's
   `session.cookieCache` removes it from the hot path — see
   [better-auth-spike.md §5](./research/better-auth-spike.md).
3. **Vercel function cold starts**, same shape as (1).
4. **Connection exhaustion** if the app ever moves off Neon's pooled
   endpoint. Currently correct: pooled for the app, direct for migrations.

Work through these before entertaining anything in Stage 3.

## 4. The stages

### Stage 1 — Extract a service layer (do this regardless)

The one move that makes every later stage cheap, and worth doing even if no
later stage ever happens.

Today the domain logic and the framework are interleaved. `saveOrderAction`
in `src/app/(dashboard)/orders/actions.ts` holds input validation, the
draft-per-user cap, and a multi-table transaction, alongside
`revalidatePath()` and `redirect()`. The rules cannot be called from
anywhere that is not a Server Action.

The split:

- `src/services/*` — `saveOrder(ctx, input)` and friends. Plain TypeScript
  over Drizzle and the schema. **No `next/*` imports, ever.** Enforce it with
  a lint rule so the boundary is mechanical rather than remembered.
- `actions.ts` — thin wrappers: call the service, then `revalidatePath` /
  `redirect`.

Reads are already part-way there; `orders/query.ts` is the shape to
generalise.

The payoff is immediate and not speculative: the same functions are what an
HTTP handler, a background job, a mobile backend, or a test would call. The
cross-org isolation test required by [ADR-0002](./adr/0002-multi-tenancy-mvp.md)
needs exactly this, because it must run without a Next.js request context.
So does every social-publishing job in Stage 2b.

Cost: mechanical, and incremental — one action at a time, no big-bang
refactor.

### Stage 2a — Durable background execution

**This is the next stage we will actually reach**, ahead of any mobile work.
Three confirmed future features need work that outlives the request that
triggered it: notifications, scheduled digests, and — the demanding one —
social publishing (§6).

Note the distinction, because conflating them causes premature migrations:
**needing a job runner is not the same as needing a separate backend.**
Durable retries, scheduling and multi-step workflows are all available
without leaving Vercel:

- Vercel Cron for anything genuinely schedule-shaped (daily digests).
- A managed workflow/queue service for anything that must retry reliably
  across steps.

The caveat on the second: it adds a vendor, and vendor eligibility is not
automatic for a Myanmar-registered entity — see
[myanmar-compliance.md](./research/myanmar-compliance.md). Check the terms
before adopting, the same way we would for a payment processor.

### Stage 2b — Add an HTTP API surface

Triggered by a second client. Given the answers in §7 this is **deferred**:
the phone-first web app is sufficient for now, and any eventual mobile app
serves staff only, not end Customers — so it reuses the existing auth,
roles and tenant model rather than introducing a new actor.

When it happens: add Route Handlers under `src/app/api/` in the *same*
Next.js app, calling the *same* services. No new deploy target, no new
infrastructure, no split. Next.js is then serving RSC to the web and JSON to
the mobile client — a BFF, without anyone having to migrate anything.

The thing that turns expensive here is the API contract, not the code.
Design endpoints around resources, not screens. A screen-shaped endpoint per
mobile view is what makes a BFF permanent and unremovable later.

**Client-language caveat.** better-auth ships an Expo integration and a
TypeScript client. A **Flutter** app (Dart) can use neither — it would talk
to the HTTP endpoints and manage tokens itself. That is workable, but it
moves the auth contract from "library handles it" to "we specify it", so
the choice between Expo and Flutter should be made *before* the API is
designed, not after.

### Stage 3 — Lift the services into a standalone backend

Only if a threshold in §5 is crossed.

Because the services carry no `next/*` imports, they move as-is into Hono,
Fastify, NestJS, or Elysia — all of which better-auth supports officially,
alongside Drizzle and Postgres. Auth moves with them by swapping an
integration import. Neon and the schema do not move at all.

Next.js then becomes either a true BFF calling the backend over HTTP, or a
pure frontend. That choice can be made at the time; it does not need
deciding now.

### Stage 4 — Separate frontends

Web (Next.js) and mobile (Expo or Flutter) over a shared backend. Only
meaningful once Stage 3 exists.

## 5. Triggers, with measurements

Plan by signal, and make the signal something you can read off a dashboard
rather than argue about. The thresholds below are starting points to
calibrate against real numbers, not laws — but a migration proposed without
reference to them should be treated as unjustified.

### 5.1 Is the phone-first web app still enough?

| Signal | How to measure | Act when |
|---|---|---|
| Perceived speed on real networks | p75 Largest Contentful Paint, mobile, from Vercel Speed Insights | p75 LCP > 4s sustained over a week after §3 fixes are done |
| Re-login friction | Rate of full sign-ins per active user per week | Users re-authenticating more than ~once a week — mobile browsers evicting cookies is a real driver toward an installed app |
| Usage intensity | Sessions per active user per day | Above ~15/day, launch friction starts to dominate and an installed shell pays for itself |
| Demand | Count of explicit "is there an app?" requests, per Organization | Two or more Organizations asking unprompted |
| Offline need | Reports of work lost to connectivity | Any recurring report — the web app has no offline story, and a PWA is the cheapest fix |

A PWA answers most of these at a fraction of the cost of Expo or Flutter.
Exhaust it before committing to a native client.

### 5.2 Is it time for an HTTP API (Stage 2b)?

Binary, not measured: a second client exists — a mobile app, a partner
integration, or a customer-facing order-status page.

### 5.3 Is it time for a separate backend (Stage 3)?

| Signal | How to measure | Act when |
|---|---|---|
| Execution ceiling | Count of requests or jobs hitting Vercel's max function duration | Any sustained non-zero rate that cannot be fixed by splitting the work |
| Platform-attributable latency | p95 function duration *minus* database time | p95 overhead > 300ms with no query to blame |
| Database headroom | Neon compute pinned at max autoscale CU; connection count vs pooler limit | Pinned at ceiling during normal working hours, not just spikes |
| Query health | p95 on the Purchase Queue and Order log queries | > 200ms after indexes have been reviewed |
| Cold-start exposure | Share of requests paying a Neon resume | Still material after autosuspend tuning |
| Long-running work | Jobs that cannot be decomposed under the function limit | Social publishing or bulk import genuinely needs a long-lived worker |
| Team shape | Number of people who need to deploy independently | More than one team blocked on a single deploy target |

**Explicitly not a trigger: more customers.** Growth in tenants alone will
not require any of this. If the reason for a migration is "we have more
users now", the reason is wrong and §2 should be checked first.

## 6. The social publishing workstream

Confirmed as a future feature: after the owner creates a Product, publish
its description and images to that Organization's Facebook, Instagram or
TikTok. It deserves its own section because it is the most architecturally
demanding thing on the horizon — more so than mobile — and because it lands
on the schema, not just the runtime.

**It makes the app write to the outside world on a tenant's behalf.** That
is a new category for this system, and it brings:

- **Per-Organization OAuth connections.** Each reseller connects their own
  accounts. New tenant-scoped tables holding access and refresh tokens,
  expiry, and granted scopes — RLS-scoped like everything else, and the
  first secrets we store per tenant. Encryption at rest for those columns
  needs deciding before the first token is written, not after.
- **A publish record per attempt.** Which Product went to which platform,
  the external post id, status, error, timestamp. Status-machine shaped,
  much like Order Item.
- **Genuinely async, multi-step, retry-heavy execution.** Instagram and
  TikTok publishing is upload-then-create-then-publish, slow, and rate
  limited. This does not fit a Server Action, and it is the concrete reason
  Stage 2a exists.
- **Platform review and business verification.** Meta and TikTok both
  require app review before an app may post on users' behalf, with lead
  times measured in weeks. **Check first whether their developer platforms
  onboard a Myanmar-registered business at all** — the
  [compliance research](./research/myanmar-compliance.md) found exactly this
  pattern with payment processors, where the law permitted what the
  vendor's terms did not. Establish this before building anything.

Sequencing follows from that last point: verify platform eligibility, then
model the connection and publish tables, then build on Stage 2a's job
runner. The eligibility check is free and can happen now.

## 7. Answered

Recorded here because the answers shape everything above.

- **Native mobile app?** Not yet. The phone-first web app is sufficient; a
  PWA, Expo or Flutter app may follow later. §5.1 sets the measurements that
  would say it is time.
- **Who would it serve?** Staff only — Customer Service and Suppliers doing
  today's work on a phone. This is the cheap branch: same API, same auth,
  same roles, same tenant model. End Customers as an actor are *not* planned,
  which removes the largest data-model risk on the horizon.
- **Background work?** Yes — notifications, scheduled reports and digests,
  and social publishing (§6). This is what makes Stage 2a real.

## 8. Still open

- **Does anything need to outlive a request in the user-facing sense?** Live
  queue updates between Supplier and Customer Service, for instance. Not yet
  decided. The default answer at current volume is polling, and websockets
  should not be built until someone actually complains about staleness —
  but this is worth settling before Stage 2b fixes an API contract.
- **Expo or Flutter**, if a native client ever happens. Affects the auth
  contract (see Stage 2b) and should be decided before the API is designed.
