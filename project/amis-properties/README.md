# AMI'S PROPERTIES

Real estate platform for The Gambia — customer app, agent portal, admin portal, and a
Node/Express/Prisma/PostgreSQL backend.

## Repository structure

```
amis-properties/
├── backend/                          Node.js + Express + TypeScript + Prisma API
│   ├── src/                          Application source
│   ├── prisma/                       Database schema + seed script
│   ├── docs/                         Database schema, per-role guides, full audit reports
│   ├── docs/audit/                   QA/Security/API/Database/Supabase readiness reports
│   ├── .env.example                  Every environment variable the app reads
│   ├── docker-compose.yml            Local Postgres + Redis + API
│   └── README.md                     Full backend setup instructions
└── frontend/
    ├── AMIS-Properties-customer-app.html    Customer app (guest browsing + accounts)
    ├── AMIS-Properties-agent-portal.html    Agent dashboard
    ├── AMIS-Properties-admin-portal.html    Admin dashboard
    └── AMIS-Properties-DEMO.html            Standalone offline demo (no backend needed)
```

Each frontend file is self-contained (HTML + CSS + JS in one file, no build step) and talks
to the backend over REST + Socket.io. Point them at your running backend's URL in
Settings → Server Connection (defaults to `http://localhost:4000/api`).

## Quick start

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL and the two JWT secrets at minimum
npm install
docker compose up -d postgres redis
npm run prisma:migrate
npm run seed
npm run dev
```

Then open any of the `frontend/*.html` files directly in a browser.

Full setup, API docs, and troubleshooting: [`backend/README.md`](backend/README.md).

## Documentation
- [`backend/docs/DATABASE_SCHEMA.md`](backend/docs/DATABASE_SCHEMA.md)
- [`backend/docs/ADMIN_GUIDE.md`](backend/docs/ADMIN_GUIDE.md), [`AGENT_GUIDE.md`](backend/docs/AGENT_GUIDE.md), [`CUSTOMER_GUIDE.md`](backend/docs/CUSTOMER_GUIDE.md)
- [`backend/docs/audit/`](backend/docs/audit/) — full production audit (start with `PRIORITIZED_FINDINGS.md`)
- [`DEPLOYMENT.md`](DEPLOYMENT.md), [`SECURITY.md`](SECURITY.md), [`CHANGELOG.md`](CHANGELOG.md), [`RELEASE_NOTES.md`](RELEASE_NOTES.md)

## Known limitations (see the audit reports for full detail)
- Payment gateways, real SMS/WhatsApp/push dispatch, and cloud media storage are modeled but
  not connected — they need real third-party credentials this repo doesn't include.
- No database migration has ever been executed against a live database in development of
  this repo — run `npm run prisma:migrate` yourself and confirm it succeeds before deploying.
- `npm run lint` requires `npm install` to have completed; it has not been executed in the
  environment this repo was prepared in, so lint has not been verified to pass cleanly.
