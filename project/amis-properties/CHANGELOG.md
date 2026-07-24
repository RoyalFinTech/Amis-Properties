# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
### Fixed
- `tsconfig.json` had `prisma/seed.ts` in `include` while `rootDir` was `src`, which
  breaks `tsc` with a TS6059 error — confirmed by actually running a type-check.
  `seed.ts` runs via `tsx` (not part of the compiled build), so it's removed from
  `include`.
- `tsconfig.json`'s `moduleResolution: "node"` was causing `npm run build` to exit
  non-zero (`TS5107`, deprecation-as-error) even though it still emitted output — confirmed
  by actually running the build and checking its exit code. Fixed using TypeScript's own
  suggested remediation (`ignoreDeprecations: "6.0"`).
- `npm run lint` referenced `eslint`, which was never listed as a dependency — would
  fail on a fresh clone. Added `eslint` + `@typescript-eslint/*` and a working
  `.eslintrc.js`.
- `npm test` would fail with "no test files found" on every run (zero test files exist
  yet). Added `--passWithNoTests` so CI doesn't false-fail on this specific issue.
- A stray empty directory from a shell brace-expansion mistake was removed from the repo.
- The `.github/` CI workflow folder was missing from earlier repository packaging (a
  `cp -r dir/*` glob silently skips dotfiles) — restored.
- Removed `nodemailer` from dependencies — genuinely unused (zero imports anywhere in
  `src/`, confirmed by direct search), unlike Cloudinary which has an explicit TODO
  marking it as intentionally staged. Re-add it when email verification is actually built.

## [v1.0.0-beta.1] — this release candidate
### Added
- Customer app, agent portal, admin portal (three separate HTML apps, one shared backend)
- Node.js/Express/TypeScript/Prisma/PostgreSQL backend: JWT + refresh token auth (phone
  OTP+PIN for customers, email+password for staff), RBAC, property CRUD, bookings,
  favorites, reviews (read-only — no submission endpoint yet), real-time chat
  (Socket.io + persisted history), admin dashboard endpoints, agent-scoped endpoints
- Account lockout after repeated failed logins; real audit logging on login and property
  writes
- Real OpenStreetMap integration on property detail (no API key required)
- WhatsApp click tracking (`POST /api/contact/whatsapp`) and backend-driven company
  contact settings (`GET /api/contact/settings`)
- Guest browsing — property browsing, search, and details require no account; only
  booking, favoriting, and chat prompt for sign-in
- Full documentation set: database schema reference, per-role user guides, and a
  complete audit report set (QA, Security, API, Database, Supabase readiness,
  production readiness, prioritized findings)

### Known limitations
See [`RELEASE_NOTES.md`](RELEASE_NOTES.md) and
[`backend/docs/audit/PRIORITIZED_FINDINGS.md`](backend/docs/audit/PRIORITIZED_FINDINGS.md)
for the complete, current list.
