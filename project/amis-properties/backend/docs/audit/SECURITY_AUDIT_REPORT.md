# Security Audit Report — AMI'S Properties

> **Status update:** H1, H2, H3, and H4 referenced below (A01, A07 sections) were fixed in
> code during this same audit pass. This report describes what was found; see
> `PRIORITIZED_FINDINGS.md` for current fix status on each item.

Verified by static code review only — no penetration testing tools were run (no live target
available in this environment). Mapped loosely to OWASP Top 10 categories.

## A01: Broken Access Control
- **H1**: property edit/status-change endpoints don't verify agent ownership.
- **H2**: booking status-change endpoint doesn't verify agent ownership.
- **H4**: `agentId` on property creation is trusted from the client body instead of derived server-side.
- Everything else checked (favorites, user profile, agent's own listings/leads, conversations) is correctly scoped to the authenticated user. This is not a systemic problem — it's two specific unscoped endpoints, not a pattern across the codebase.

## A02: Cryptographic Failures
- Passwords and PINs hashed with bcrypt, cost factor 12 — reasonable for 2026 hardware.
- JWT secrets validated ≥16 chars at boot; real secrets are not committed (I3).
- No encryption at rest configured for the database itself — that's an infrastructure/hosting decision (e.g. Supabase encrypts at rest by default), not something the application code controls. **Not verified** — depends on hosting choice.

## A03: Injection
- **SQL injection**: not found. All queries go through Prisma's parameterized query builder; no raw SQL (`$queryRaw`/`$executeRaw`) is used anywhere in the codebase.
- **NoSQL/command injection**: not applicable — no shell execution, no NoSQL database.

## A04: Insecure Design
- Refresh-token rotation doesn't consult the database (**H3**) — a design gap, not just a bug: the system was designed to check JWT validity only, not maintain real server-side session state despite having the tables (`RefreshToken.revoked`, `Session.revoked`) to do so.
- No logout endpoint exists — same root cause as H3.

## A05: Security Misconfiguration
- Helmet is applied (sets a reasonable set of secure headers by default).
- CORS restricted to one configured origin, not wildcarded (positive), but only supports one origin at a time (**L2**).
- Error handler correctly suppresses stack traces in production (I2).
- `express.static` on `/uploads` has no additional hardening (no `Content-Disposition: attachment` forcing download, no CSP restricting what uploaded content can execute) — relevant to M3 below.

## A06: Vulnerable and Outdated Components
- **Not verified** — checking real dependency CVEs requires `npm audit` against installed `node_modules`, which requires `npm install` (network access), unavailable in this environment. Recommend running `npm audit` as part of CI (the GitHub Actions workflow doesn't currently include this step — worth adding).

## A07: Identification and Authentication Failures
- Account lockout after 5 failed attempts, 15-minute cooldown — implemented and verified in code (previous update).
- **Gap**: lockout doesn't revoke existing refresh tokens (**M5**) — a compromised session survives a lockout event.
- OTP codes are hashed before storage (not stored in plaintext) — verified, positive.
- No maximum session count / device management enforcement — `Session` table exists but nothing writes to it currently (it's modeled, not wired up).

## A08: Software and Data Integrity Failures
- No CI step verifies lockfile integrity or run `npm ci` with an audit gate — **not verified**, this is a process gap in `.github/workflows/ci.yml` rather than application code.

## A09: Security Logging and Monitoring Failures
- Real audit logging now exists for login + property writes (previous update) — a genuine improvement, but coverage is partial (booking status changes, agent deletion, and notification broadcasts aren't logged yet).
- No alerting/monitoring integration (Sentry, Datadog, etc.) — expected for this stage, flagged as informational only.

## A10: Server-Side Request Forgery (SSRF)
- Not found. No endpoint fetches a user-supplied URL server-side (the Cloudinary integration point is an unimplemented TODO, not live code).

## File Upload Vulnerabilities (explicitly requested)
- **M1**: filename not sanitized against path traversal.
- **M2**: MIME type trusted from client header, not verified against actual file bytes.
- **M3**: uploaded files served statically with no execution-prevention headers — a bypassed malicious file (e.g. an `.svg` with an embedded script, disguised with an `image/svg+xml`-adjacent spoofed header) could be a stored-XSS vector if a victim opens the direct `/uploads/...` URL.

## CSRF
- Low risk **by design**, not by an explicit CSRF token: all authenticated writes require a `Authorization: Bearer <token>` header that a browser won't attach automatically the way it does cookies, so a forged cross-site form/request can't carry a valid token. This holds only as long as tokens stay out of cookies — see M4's trade-off note.

## IDOR
- See A01 above — H1, H2, H4 are the concrete IDOR-shaped findings. Everywhere else checked was correctly scoped.

## Secrets Management
- `.env` git-ignored, `.env.example` uses obvious placeholders, no secrets found hardcoded in source. Positive (I3).

## Session Security
- JWT access tokens short-lived (15 min default), refresh tokens long-lived (30 days) — reasonable split, but undermined by H3 (no real revocation).
- Frontend stores both tokens in `localStorage` (M4) — an accepted trade-off given the bearer-token/no-CSRF design, but worth knowing: if any XSS is ever introduced elsewhere on the page, tokens are directly readable by injected script. An httpOnly-cookie-based design would close that specific exposure at the cost of needing real CSRF protection.
