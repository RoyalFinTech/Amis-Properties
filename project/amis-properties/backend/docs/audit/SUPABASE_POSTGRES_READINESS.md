# Supabase PostgreSQL Readiness Report

**Verified by:** reading `prisma/schema.prisma`, `.env.example`, `docker-compose.yml`.
**Not verified:** actually connecting to a Supabase project — none was available in this
environment. Everything below is "here's what the code says," not "here's what happened
when we connected."

## Compatibility: mostly yes, with one real blocker

Supabase's database is standard PostgreSQL — this project already targets
`provider = "postgresql"` in Prisma, uses no Postgres extensions outside the standard set,
and doesn't rely on any hosting-specific SQL. That part is genuinely compatible as-is.

### Real blocker found: missing `directUrl`
Supabase connections come in two forms:
- A **pooled** connection (port 6543, via PgBouncer in transaction mode) — meant for your
  running application.
- A **direct** connection (port 5432) — required for schema migrations, because PgBouncer's
  transaction pooling doesn't support the prepared statements Prisma's migration engine uses.

Current schema:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
This only has one connection string. Recommended fix:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled, port 6543 — for the running app
  directUrl = env("DIRECT_URL")     // direct, port 5432 — for `prisma migrate`
}
```
And add `DIRECT_URL` to `.env.example` alongside `DATABASE_URL`. Without this, `prisma
migrate deploy` against a Supabase project is likely to fail or behave unreliably — this is
a well-documented Prisma+Supabase requirement, not a guess specific to this codebase, but I
can't confirm the exact failure mode without an actual Supabase project to test against.

## Tables, relationships, foreign keys, indexes, constraints
Covered in `DATABASE_AUDIT_REPORT.md` — nothing about them is Supabase-specific; they'll
behave the same on Supabase as on any other Postgres host.

## Migrations
No migration history exists yet in this project (never run against a live database). First
deploy to Supabase should be:
```bash
npx prisma migrate dev --name init   # locally, or against a Supabase dev branch
npx prisma migrate deploy            # production, using DIRECT_URL
```

## Seed data
`prisma/seed.ts` uses plain Prisma Client calls — no Supabase-specific seeding features
needed. Works as-is once `DATABASE_URL`/`DIRECT_URL` point at Supabase.

## Connection pooling
Already discussed above — this is the main thing to get right. Prisma's own connection pool
(client-side) is separate from Supabase's PgBouncer (server-side); using the pooled URL for
the app and direct URL for migrations is the standard pattern, not something unusual to this
project.

## Query performance
Not verified — no live Supabase project to measure against. The query patterns themselves
(reviewed in the Database report) don't show N+1 issues, which is the main thing likely to
matter regardless of host.

## Transactions
Noted in the Database report: no `prisma.$transaction()` calls exist yet anywhere in the
codebase. Not Supabase-specific, but worth fixing before relying on Supabase's connection
pooling under real concurrent load, where partial-write races become more likely to actually
happen.

## Bottom line
This project **can** run against Supabase Postgres. The one concrete code change needed
first is adding `directUrl` to the Prisma schema and a `DIRECT_URL` env var. Everything else
is "same as any Postgres host" and was already covered in the Database Audit Report.
