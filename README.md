# Mini POS

Product catalog and daily order coordination for Customer Service and
Suppliers — see [`docs/PRD.md`](./docs/PRD.md) for the full context on
what this replaces and why.

## Docs

- [`docs/PRD.md`](./docs/PRD.md) — product requirements
- [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) — stack & infra decisions
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — schema

## Getting started

```bash
npm install
neon link                    # once, links this repo to the Neon project
neon checkout main           # pulls DATABASE_URL / DATABASE_URL_UNPOOLED into .env.local
npm run db:generate          # generate SQL from src/db/schema.ts
npm run db:migrate           # apply it, via the owner role (DATABASE_URL_UNPOOLED)
npm run dev
```

The pulled `DATABASE_URL` from `neon checkout` is the **owner** role —
fine for `db:migrate`, but the app itself must run against the
**`app_user`** role instead (see
[`docs/TECH_STACK.md`](./docs/TECH_STACK.md#neon-role-setup-app_user-vs-the-owner-role)
for why, and the exact `CREATE ROLE` to run once per database). Swap
`DATABASE_URL` in `.env.local` to `app_user`'s connection string before
running `npm run dev`. Also fill in the R2 and `AUTH_SECRET` values from
`.env.example`.

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) on Vercel · Neon Postgres · Drizzle · self-rolled
auth (session cookies, argon2) · Cloudflare R2. Full rationale in
[`docs/TECH_STACK.md`](./docs/TECH_STACK.md).
