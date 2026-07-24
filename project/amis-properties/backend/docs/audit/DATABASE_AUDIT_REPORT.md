# Database Audit Report — AMI'S Properties

Based on static review of `prisma/schema.prisma` and `prisma/seed.ts`. No live database
connection was available to inspect actual generated DDL, query plans, or run `EXPLAIN` —
those items are explicitly marked "Not verified" below rather than assumed.

## Schema completeness
Every table requested in your list exists: Users, Agents, Customers (via `User.role`),
Properties, Categories, Property Images, Amenities, Favorites, Reviews, Ratings (via
`Review.rating`, not a separate table — same thing), Bookings, Appointments (same as
Bookings — one table, not two, intentional), Messages, Notifications, Payments,
Transactions (via `Payment`, not a separate table), Audit Logs, FAQs (not modeled — FAQ
content currently lives in the demo file only, not the real backend; **genuine gap** if
you want FAQs manageable from the real admin portal), Support Tickets, Roles & Permissions
(modeled as `Role`/`Permission` tables but **not currently used anywhere** in the actual
authorization logic — RBAC is enforced via the `User.role` enum + `requireRole()`
middleware, not by querying these tables. They're present but functionally dead. Worth
either wiring them up for real dynamic permissions or removing them to avoid confusion),
Website Content (`Setting` table, seeded with `company_info`), Analytics (no dedicated
table — computed on-the-fly from counts in `/api/admin/stats` and `/api/agent/stats`,
which is a reasonable approach at this scale and doesn't need its own table).

## Relationships & Foreign Keys
- Cascade behavior reviewed: deleting a `User` cascades to sessions, tokens, favorites,
  bookings (as customer), messages sent, notifications, reviews, invoices, support tickets,
  activity logs (`onDelete: Cascade`) — correct, avoids orphaned rows.
- Deleting an `Agent` does **not** cascade to their `Property` rows (`agentId` is optional
  on `Property`, relation has no explicit `onDelete` — Prisma defaults to `Restrict` for
  required relations, but this one is optional, so deletion sets `agentId` to null implicitly
  only if you configure `onDelete: SetNull`, which isn't currently set). **This means
  deleting an Agent row will currently fail with a foreign key constraint error if they
  have any properties, rather than orphaning or reassigning them** — arguably correct
  behavior (forces you to reassign listings first) but worth confirming it's the behavior
  you want, since the admin UI's "Delete Agent" button doesn't currently handle that error
  gracefully (Agent Portal doesn't expose delete; only the demo file's admin panel does, and
  it operates on in-memory demo data, not the real database).

## Indexes
- Explicit indexes present: `User.role`, `Property(status, purpose, type)` composite,
  `Property.price`, plus unique constraints on `Favorite(userId, propertyId)`,
  `RecentlyViewed(userId, propertyId)`, `Conversation(propertyId, customerId)`,
  `City(name, stateId)`, `State(name, countryId)`.
- Foreign-key scalar columns elsewhere (`Booking.customerId`, `Booking.propertyId`,
  `Message.conversationId`, `Review.propertyId`, etc.) have **no explicit `@@index`**.
  Whether Prisma's migration engine adds one automatically depends on the Prisma version
  and is **not verified** here — no database connection was available to generate and
  inspect the actual migration SQL. Recommend explicitly adding `@@index` to these before
  going live rather than relying on an unverified default.

## Constraints
- `@unique` correctly applied to `User.phone`, `User.email`, `Agent.userId`,
  `RefreshToken.tokenHash`.
- Decimal precision looks reasonable for currency (`@db.Decimal(14, 2)` for prices,
  matching GMD/USD amounts without floating-point rounding risk) — correct choice over
  using `Float`.

## Migrations
- No migration files exist in the delivered project (`prisma/migrations/` directory isn't
  present) — expected, since no database connection was available to run
  `prisma migrate dev` and generate one. **You must run this yourself** before first
  deploy; it isn't something that can be pre-generated without a live database.

## Seed data
- `prisma/seed.ts` creates one admin user, one country/state/city, one category, seven
  amenities, one sample property, and the `company_info` setting. Functional and verified
  by reading the file — **not verified by actually running it**, since that requires a
  database connection.

## Connection pooling & transactions
- `src/lib/prisma.ts` uses a singleton `PrismaClient` pattern correctly (avoids exhausting
  connections on hot-reload in dev). No explicit connection pool size configured — Prisma's
  default is used. **Not verified** under real load.
- No multi-statement transactions (`prisma.$transaction`) are used anywhere in the codebase.
  This is a real gap: e.g. `Booking` status updates and the corresponding notification, or
  property deletion alongside its audit log entry, aren't wrapped atomically — if the audit
  log write fails after the main write succeeds, you get a real change with no audit trail,
  or vice versa. Low practical risk today (both are simple single-table writes to a local
  Postgres instance), but worth wrapping before scale.

## Query performance / N+1
- Reviewed the property search and detail queries — they use Prisma's `include` with
  explicit relation selection (not looping and querying per-row), so no N+1 pattern was
  found in the main listing/detail paths.
- Admin's `/agents` and `/users` endpoints use `_count` sub-selects rather than separate
  queries — correct pattern, avoids N+1.
- **Not verified**: actual query plans, index usage, or performance under realistic data
  volume — requires a live database with representative data.
