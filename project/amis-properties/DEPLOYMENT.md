# Deployment Guide — AMI'S Properties

## What's actually configured in this repo
- `backend/Dockerfile` — multi-stage build for the API
- `backend/docker-compose.yml` — Postgres + Redis + API, for local/self-hosted use
- `backend/.github/workflows/ci.yml` — GitHub Actions: install, generate, migrate, build, test

## What's NOT configured — stated plainly, not guessed
No Render, Railway, Vercel, Fly.io, or other platform-specific config files exist in this
repo (no `render.yaml`, `railway.json`, `fly.toml`, etc.). If you deploy to one of those,
you'll create that platform's config yourself — this guide doesn't assume a specific host.

## Environment variables required in production
Every variable in `backend/.env.example` must be set. At minimum, non-optional ones:
- `DATABASE_URL` — your production Postgres connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate fresh with `openssl rand -base64 48`,
  never reuse the placeholder text from `.env.example`
- `CLIENT_ORIGIN` — the real origin(s) your frontend is served from (CORS)
- `NODE_ENV=production`

Optional but recommended before real users touch this:
- `TWILIO_*` (real SMS OTP delivery — without these, OTP codes only log to the server
  console, which is fine for development and unacceptable for production)
- `CLOUDINARY_*` (cloud media storage — without these, uploads write to local disk, which
  won't survive a redeploy on most hosting platforms with ephemeral filesystems)
- `SMTP_*` (currently unused by any code path — reserved for a future email-verification
  feature that isn't built yet; see `RELEASE_NOTES.md`)

## Deploying with Docker (self-hosted / VPS)
```bash
cd backend
cp .env.example .env    # fill in real values
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed   # optional — creates one admin account; change its password immediately after
```

## Deploying to a managed platform (Render, Railway, Fly.io, etc.)
General steps, since no platform-specific config exists yet:
1. Point the platform at `backend/` as the build root.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Set every required env var from `.env.example` in the platform's dashboard.
5. Run `npx prisma migrate deploy` once against the production database — either as a
   release/pre-deploy hook if your platform supports one, or manually the first time.
6. If your database is Supabase specifically, see
   `backend/docs/audit/SUPABASE_POSTGRES_READINESS.md` first — it documents a required
   schema change (`directUrl`) that hasn't been applied yet.

## Frontend deployment
The three frontend apps (`frontend/*.html`) are static, single files with no build step —
host them anywhere that serves static files (S3+CloudFront, Netlify, Vercel static,
GitHub Pages, or the same server as the API). Each one has its own "Server Connection"
setting where you point it at your deployed backend's API URL.

## Post-deploy checklist
- [ ] Changed the seeded admin password
- [ ] Real JWT secrets generated and set (not the `.env.example` placeholders)
- [ ] `CLIENT_ORIGIN` matches your actual frontend origin(s) — CORS currently supports one
      origin at a time (see `docs/audit/PRIORITIZED_FINDINGS.md`, finding L2)
- [ ] Database migration has been run against the production database
- [ ] Confirmed HTTPS is terminated somewhere in front of the API (this app doesn't
      terminate TLS itself — that's expected to be handled by your platform/reverse proxy)

## Not verified
None of the above has been executed against a real deployment target in this environment —
no network access, no live database, no cloud accounts. This document describes the
configuration that exists in the repo and the steps it implies; it is not a report of a
successful deployment.
