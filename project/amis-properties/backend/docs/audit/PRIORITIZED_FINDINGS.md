# Prioritized Findings — AMI'S Properties Production Audit

**Method:** static code review of the actual backend source (`src/`, `prisma/schema.prisma`)
and both frontend HTML apps. No live server, database, or Supabase instance was available in
this environment — anything requiring a running system is marked "Not verified" rather than
assumed. Every finding below was confirmed by reading the specific file/line, not inferred.

---

## Critical
**None found.** No SQL injection, no hardcoded secrets, no auth bypass on public routes.

## High
**Status: all four fixed in this pass** (code changes applied, see below each row).

| # | Finding | File | Fix applied |
|---|---|---|---|
| H1 | `PATCH /api/properties/:id` and `PATCH /api/properties/:id/status` check only role=AGENT, **not property ownership** — any agent can edit or change the status of *any* agent's listing, not just their own. Contradicts the Agent Guide, which claims this is enforced. | `src/routes/property.routes.ts` | ✅ Added `assertCanManageProperty()` in `property.service.ts`, called from `update`/`remove`/`setStatus` in the controller. Admins bypass the check; agents are 403'd on listings they don't own. |
| H2 | `PATCH /api/bookings/:id/status` checks only role=AGENT, **not booking ownership**. | `src/routes/booking.routes.ts` | ✅ Now looks up the booking's property→agent chain and 403s an agent who doesn't own it. Admins unaffected. Also now writes an audit log entry (previously booking status changes weren't logged at all). |
| H3 | Refresh-token rotation only verifies the JWT — never checks the `RefreshToken` table or `revoked` flag; no logout endpoint existed. | `src/services/auth.service.ts` | ✅ `rotateRefreshToken` now matches the presented token against stored hashes, rejects if not found/already revoked, and revokes it before issuing a new pair (real single-use rotation). Added `POST /api/auth/logout` that revokes a token on demand. Account lockout now also revokes all of that user's active refresh tokens (closes M5 at the same time). |
| H4 | `POST`/`PATCH /api/properties` had zero input validation; `agentId` was trusted from the client body. | `src/controllers/property.controller.ts` | ✅ Added a full Zod schema for property writes. `agentId` is now derived server-side from the authenticated agent's own profile; an admin can still explicitly assign a listing to a specific agent via `agentIdOverride`, but a regular agent's request body is never trusted for this. |

## Medium
| # | Finding | File |
|---|---|---|
| M1 | Uploaded file names are only whitespace-stripped, not sanitized with `path.basename()` or replaced with a generated ID — a crafted `originalname` containing `../` could escape the uploads directory. | `src/routes/media.routes.ts` |
| M2 | File type is validated only by the client-supplied `Content-Type` header (`file.mimetype`), not by inspecting actual file bytes (magic numbers). A renamed malicious file can bypass the filter. | `src/routes/media.routes.ts` |
| M3 | Uploaded files are served as-is via `express.static("/uploads")` with no `Content-Disposition`/`X-Content-Type-Options` hardening — a bypassed upload (e.g. `.svg` or `.html` with a spoofed image MIME type) would be served and could execute in a browser if opened directly, a stored-XSS vector via user-uploaded media. | `src/app.ts`, `src/routes/media.routes.ts` |
| M4 | JWT access + refresh tokens are stored in `localStorage` on the frontend, not httpOnly cookies — readable by any script if an XSS vulnerability is ever introduced elsewhere in the page. (No CSRF risk currently exists *because* of this, so it's a real trade-off, not a pure negative — see Security report.) | `app.html` |
| M5 | Account lockout (added in the previous pass) blocks new login attempts but does **not** revoke already-issued refresh tokens for that account — combined with H3, a locked-out account's existing session keeps working. | `src/services/auth.service.ts` |
| M6 | No API versioning (`/api/v1/...`) — all routes are unversioned at `/api/...`. Fine for a single-client system today, but a breaking change later has no safe rollout path. | `src/app.ts` |
| M7 | Supabase + Prisma compatibility: `schema.prisma` has no `directUrl`. Supabase's pooled connection (PgBouncer, port 6543) doesn't support the prepared statements Prisma's migration engine needs — without a separate direct connection URL for migrations, `prisma migrate deploy` against Supabase is likely to fail. **Not verified against a live Supabase instance** — this is a known, documented Prisma+Supabase requirement, flagged here because the schema is missing it. | `prisma/schema.prisma` |

## Low
| # | Finding | File |
|---|---|---|
| L1 | `cookie-parser` is imported and mounted but never used anywhere — dead middleware. | `src/app.ts` |
| L2 | CORS allows exactly one origin (`CLIENT_ORIGIN`). With three separate frontend apps potentially hosted on different origins in production, only one can be allow-listed at a time. | `src/app.ts` |
| L3 | No structured/persistent logging — `morgan` writes to stdout only; no request IDs, no log shipping, no correlation between a request and its audit-log entry. | `src/app.ts` |
| L4 | Foreign-key columns (`Booking.customerId`, `Message.conversationId`, etc.) have no *explicit* `@@index` in the schema. Prisma's migration engine may or may not add one automatically depending on version — **not verified**, since generating the actual migration requires a database connection this environment doesn't have. | `prisma/schema.prisma` |
| L5 | `POST /api/bookings` doesn't verify `propertyId` exists before insert — an invalid ID surfaces as a raw Prisma foreign-key error through the generic 500 handler instead of a clean 400. | `src/routes/booking.routes.ts` |
| L6 | *(Found while fixing H3)* Staff login (`loginWithPassword`) always issues and stores a refresh token server-side, but neither `admin-portal.html` nor `agent-portal.html` ever store or use it client-side — only the access token is kept. This means every staff login leaves a valid, unused 30-day refresh token in the database that nothing will ever revoke through normal use (their "logout" button has nothing to call now that H3 is fixed, because they never had a client-side refresh token to revoke). Not exploitable without direct database access, but worth cleaning up — either stop issuing a refresh token on staff login, or start using it. |

## Informational
| # | Note |
|---|---|
| I1 | Positive finding: `favorite.routes.ts` correctly scopes every query to `req.user.id` from the JWT — no IDOR there. |
| I2 | Positive finding: production error responses correctly hide internal error details (`NODE_ENV==='production'` check) — no stack-trace leakage. |
| I3 | Positive finding: `.env` is git-ignored, `.env.example` contains no real secrets, `JWT_*_SECRET` are validated to be ≥16 chars at boot. |
| I4 | Supabase's native Auth, Storage, Realtime, and Row Level Security are **not used at all** by this codebase — see the Supabase MCP Readiness report. This isn't a bug, just a scope clarification: this is a self-hosted Express/Prisma stack that can point at a Supabase *Postgres database*, not a Supabase-native application. |
| I5 | Payment gateway, SMS/WhatsApp/push dispatch, and Cloudinary storage remain unconnected — already disclosed in prior reports, restated here for completeness of this audit. |

---

## Recommended fix order
1. ~~H1, H2~~ — **done this pass.**
2. ~~H4~~ — **done this pass.**
3. ~~H3 + M5~~ — **done this pass.**
4. **M1–M3** — sanitize upload filenames (use a generated ID, not the original name), and note that real MIME sniffing needs a library like `file-type` reading actual bytes. Not yet fixed.
5. **L6** (new) — decide whether staff logins should issue a refresh token at all, since neither portal currently uses one.
6. Everything else is genuinely lower urgency for an initial production launch.
