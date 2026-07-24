# API Audit Report — AMI'S Properties

Covers every route file in `src/routes/`. Findings reference IDs in `PRIORITIZED_FINDINGS.md`.

## Route inventory

| Base path | File | Auth | Notes |
|---|---|---|---|
| `/api/auth/*` | auth.routes.ts | Mixed | OTP request/verify, PIN create/login, staff login, refresh — all public, rate-limited on OTP endpoints (5/10min) |
| `/api/properties/*` | property.routes.ts | Mixed | GET public; write ops AGENT/ADMIN — see **H1, H4** |
| `/api/bookings/*` | booking.routes.ts | Auth required | Status update unscoped — see **H2** |
| `/api/favorites/*` | favorite.routes.ts | Auth required | Correctly self-scoped (I1) |
| `/api/users/*` | user.routes.ts | Auth required | `/me` GET/PATCH only, correctly self-scoped |
| `/api/media/*` | media.routes.ts | AGENT/ADMIN | See **M1, M2, M3** |
| `/api/admin/*` | admin.routes.ts | ADMIN/SUPER_ADMIN | Gated at router level via `router.use(requireRole(...))` — correct |
| `/api/agent/*` | agent.routes.ts | AGENT/ADMIN/SUPER_ADMIN | Correctly self-scoped via `currentAgent()` helper |
| `/api/conversations/*` | message.routes.ts | Auth required | Correctly participant-scoped via `assertParticipant()` |

## Verified working
- **Authentication**: phone+OTP+PIN for customers, email+password for staff — both real, backed by bcrypt hashing and JWT issuance.
- **Authorization (RBAC)**: `requireRole()` middleware present and correctly applied on all admin/agent-only routes *except* the two gaps in H1/H2.
- **Rate limiting**: global 300 req/15min, OTP endpoints 5 req/10min. No per-route limit on login attempts beyond the new account-lockout counter (which is a data-layer control, not a rate limiter) — acceptable, but worth noting login isn't separately rate-limited by IP.
- **Pagination**: implemented on property search (`page`/`perPage`) and admin user list. **Not implemented** on `/api/bookings/mine`, `/api/agent/leads`, `/api/conversations/:id/messages` (capped at 200, not paginated), or `/api/admin/bookings` (capped at 200) — fine at demo scale, a real gap at production scale.
- **Search**: property search supports keyword, type, purpose, price range, bedrooms, bathrooms, amenities, city, sort — genuinely functional against the database, not simulated.
- **Sorting**: `sort=price_asc|price_desc|newest` on property search only. No sorting on other list endpoints.
- **File uploads**: functional (local disk), see Security report for the specific gaps.
- **API versioning**: absent — see **M6**.
- **Error handling**: centralized via `errorHandler`, correctly hides internals in production (I2).
- **Logging**: request logging via `morgan` only — see **L3**.
- **Audit logs**: real, populated on login + all property writes (see previous update). **Not** populated on booking status changes, agent deletion, or notification sends — partial coverage.

## Duplicate/overlapping routes found
- `PATCH /api/bookings/:id/status` (unscoped, any agent) vs `PATCH /api/agent/leads/bookings/:id/status` (correctly scoped to the agent's own bookings) do the same job with different access control — this is the concrete instance of **H2**. Recommendation: either remove the unscoped one or add the same ownership check to it.

## Unused/dead code found
- `cookie-parser` middleware mounted, never read or written anywhere (**L1**).

## Not verified (requires a running server)
- Actual latency/throughput under load.
- Real behavior of Prisma's generated SQL for the search endpoint's `OR`/`contains` filters at scale.
- Whether the 300 req/15min global limiter is appropriately tuned for real traffic — this is a guess, not a measurement.
