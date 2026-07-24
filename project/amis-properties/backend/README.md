# AMI'S PROPERTIES — Backend API

Node.js + Express + TypeScript + Prisma + PostgreSQL backend for the AMI'S PROPERTIES
real estate platform (Kotu Manjai, The Gambia).

## What's actually built here (real, runnable code)

- **Database**: full Prisma schema — users/agents/admins, roles, properties, images/videos/
  floor plans, categories, amenities, bookings, offers, favorites, messages, notifications,
  payments/invoices, reviews, blog, support tickets, audit/activity logs, locations
  (country → state → city)
- **Auth**: phone + OTP + PIN flow for customers (matches the mobile app), email + password
  login for agents/admins, JWT access + refresh tokens, refresh-token rotation, rate-limited
  OTP endpoints
- **Properties**: full CRUD, search with filters (location, price range, bedrooms, bathrooms,
  amenities, type, purpose), pagination, sorting, slug-based detail lookup with view counts
- **Bookings**: inspection scheduling, status updates (confirm/reschedule/cancel/complete)
- **Favorites**, **user profile**, **media upload** (local disk by default; Cloudinary hook
  is wired but inactive until you add keys)
- **Real-time**: Socket.io wired for chat (join room, send message, typing indicator) plus full REST
  endpoints (`/api/conversations/start`, `/mine`, `/:id/messages`) that persist history and broadcast
  new messages live to whoever's in that conversation's room. Customers start a conversation from a
  property listing; agents see all their conversations in the portal's Messages tab.
- **Security**: Helmet, CORS, rate limiting, bcrypt password/PIN hashing, Zod validation on
  every input, centralized error handling, **account lockout** after 5 failed login attempts
  (15-minute cooldown, both PIN and staff password login), and a **real audit trail**
  (`AuditLog` table) populated on login events and every property create/update/delete/
  status-change — viewable via `GET /api/admin/audit-logs`.
- **Maps**: the customer app's property detail screen embeds a real OpenStreetMap view
  (no API key required) using the listing's coordinates when set, with a working
  "Get Directions" link.
- **Docs**: Swagger/OpenAPI at `/api/docs` once the server is running
- **Ops**: Dockerfile, docker-compose (Postgres + Redis + API), GitHub Actions CI

## What is NOT built yet, on purpose

I didn't fake these — they need real third-party accounts and credentials I don't have:

- **Payments** (Wave, Afrimoney, Stripe, Flutterwave, PayPal, bank transfer): schema exists
  (`Payment`, `Invoice` models), but no provider SDK is wired in. Each provider has a very
  different integration shape (webhooks, redirect flows, mobile money USSD, etc.) — tell me
  which ones you actually have merchant accounts for and I'll wire those specifically.
- **WhatsApp Business API / push notifications**: needs a Meta Business/WhatsApp Cloud API
  account and an FCM/APNs project. `Notification` model exists; dispatch logic doesn't.
- **AI features** (recommendations, chat assistant, price estimator): needs a model/API
  provider and real listing data to be useful — happy to build once there's data to train/
  query against.
- **Agent/Admin/Customer frontend UIs**: this repo is backend-only. The customer mobile web
  app already exists as a separate HTML file; the admin and agent dashboards haven't been
  built yet.
- **GraphQL**: schema is REST-first; the models are structured so a GraphQL layer could be
  added later if you need it.

## Getting started

```bash
cp .env.example .env
# fill in DATABASE_URL and the two JWT secrets at minimum

npm install
docker compose up -d postgres redis   # or point DATABASE_URL at your own Postgres
npm run prisma:migrate
npm run seed                          # creates an admin login + one sample property
npm run dev
```

API will be at `http://localhost:4000`, docs at `http://localhost:4000/api/docs`.

## Documentation
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — what every table is for
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md), [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md), [`docs/CUSTOMER_GUIDE.md`](docs/CUSTOMER_GUIDE.md) — per-role user guides
- [`docs/audit/`](docs/audit/) — full production QA/security/API/database/Supabase readiness audit, with a prioritized findings list (`docs/audit/PRIORITIZED_FINDINGS.md` is the best starting point)

Seeded admin login: `amispropertiesgambia@gmail.com` / `ChangeMe123!` — **change this
password immediately**, it's only there so you have a way in on day one.

## Suggested next steps, in order

1. Confirm which payment providers you actually have accounts with — I'll wire those, not
   all seven.
2. Wire WhatsApp/SMS/push dispatch once you have the relevant accounts.
3. Add typing indicators and read receipts to the chat UI (the backend already emits a `typing`
   socket event; no frontend listens for it yet).

**Note:** the `Conversation` model gained `propertyId`/`customerId`/`agentId` columns, and
`User` gained `failedLoginAttempts`/`lockedUntil` columns, across recent updates. Run
`npm run prisma:migrate` again to pick these up if you migrated before.
