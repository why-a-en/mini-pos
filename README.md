# Mini POS

Product catalog and daily order coordination for a Myanmar-based
cross-border resale business: Support Agents log customer requests against
a Product catalog, Suppliers buy those Products from Lazada/TikTok Shop,
and Support Agents pack and ship them once they arrive.

The app is multi-tenant — every row belongs to an **Organization**, and the
boundary is enforced by Postgres row-level security rather than by
application code. [`CONTEXT.md`](./CONTEXT.md) defines the vocabulary
(Organization, Admin, Support Agent, Supplier, Order Item …); read it first
if a term here is unfamiliar.

It is a **phone app first** — designed at 375px, monochrome, and meant to
feel installed rather than loaded. See the UI conventions in
[`CLAUDE.md`](./CLAUDE.md).

## Docs

- [`CONTEXT.md`](./CONTEXT.md) — the domain model and its vocabulary
- [`docs/PRD.md`](./docs/PRD.md) — product requirements
- [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) — stack & infra decisions
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — schema
- [`docs/ARCHITECTURE_ROADMAP.md`](./docs/ARCHITECTURE_ROADMAP.md) — what's next
- [`docs/adr/`](./docs/adr/) — decisions and their reasoning:
  [0001](./docs/adr/0001-order-item-lifecycle-and-packing.md) order item
  lifecycle · [0002](./docs/adr/0002-multi-tenancy-mvp.md) multi-tenancy ·
  [0003](./docs/adr/0003-password-recovery-and-forced-change.md) passwords

## Getting started

```bash
pnpm install
neon link                    # once, links this repo to the Neon project
neon checkout main           # pulls DATABASE_URL / DATABASE_URL_UNPOOLED into .env.local
pnpm db:generate             # generate SQL from src/db/schema.ts
pnpm db:migrate              # apply it, via the owner role (DATABASE_URL_UNPOOLED)
pnpm dev
```

### The `app_user` role is not optional

`neon checkout` writes the **owner** role into `DATABASE_URL`. That's the
right role for `db:migrate`, but the app must run as **`app_user`** —
row-level security does not apply to the owner, so running the app as owner
silently disables every tenant boundary.

Create `app_user` with plain SQL, **not** `neon roles create` or the
console: those grant `BYPASSRLS`. The exact `CREATE ROLE` / `GRANT`
statements are in
[`docs/TECH_STACK.md`](./docs/TECH_STACK.md#neon-role-setup-app_user-vs-the-owner-role).
Then swap `DATABASE_URL` in `.env.local` to `app_user`'s pooled connection
string, and fill in the R2 and `BETTER_AUTH_*` values from
[`.env.example`](./.env.example).

### Create the first Organization

There is no public signup screen — the Organization, its first Admin and a
first Store are bootstrapped from the command line
([ADR-0002](./docs/adr/0002-multi-tenancy-mvp.md) decision 10,
[ADR-0004](./docs/adr/0004-stores-within-an-organization.md) decision 6):

```bash
pnpm org:create "Acme Resale" admin@acme.com "Aung Aung" <password> admin "Main"
pnpm member:add supplier@example.com acme-resale supplier "Full Name" <password>
pnpm member:add cs@example.com acme-resale support_agent --stores "Main,Yangon"
```

The last argument to `org:create` is the first Store's name (defaults to
`Main`). `member:add` grants every Store by default, or just the named
ones with `--stores`. After that, an Admin adds staff and further Stores
in-app — a brand-new Organization with no Store walks its Admin through
`/onboarding` on first login.

`member:add` also puts an *existing* person into a second Organization —
that's what lets one shared Supplier source for several resellers with a
single login.

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
pnpm test
```

Tests run against the real Neon database, not a mock: the tenant boundary
*is* Postgres RLS, so stubbing the database out would test nothing.
`DATABASE_URL` must therefore point at `app_user` when you run them.

## Stack

Next.js (App Router) on Vercel · Neon Postgres with RLS · Drizzle ·
better-auth · Tailwind v4 + shadcn/ui · nuqs · Cloudflare R2 · Vitest.
Full rationale in [`docs/TECH_STACK.md`](./docs/TECH_STACK.md).

## Working on it

Trunk-based: short-lived `feat/…`, `fix/…`, `chore/…` branches off `main`,
merged by PR. `main` is always deployable and Vercel ships it on merge; Neon
branches the database per PR, so migrations never run against production
data. Details in [`CLAUDE.md`](./CLAUDE.md).
