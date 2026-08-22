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
cp .env.example .env.local   # fill in DATABASE_URL, R2 creds, AUTH_SECRET
npm install
npm run db:generate          # generate SQL from src/db/schema.ts
npm run db:migrate           # apply it to the DATABASE_URL above
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) on Vercel · Neon Postgres · Drizzle · self-rolled
auth (session cookies, argon2) · Cloudflare R2. Full rationale in
[`docs/TECH_STACK.md`](./docs/TECH_STACK.md).
