# Admin Guide — AMI'S Properties

## Logging In
Open `AMIS-Properties-admin-portal.html`, sign in with your admin email/password.
If it can't reach the server, check **Settings → Server Settings → API Base URL** points
at your running backend (default `http://localhost:4000/api`).

The seeded default is `amispropertiesgambia@gmail.com` / `ChangeMe123!` — **change this password
immediately** after your first login (currently done via direct database update or
`prisma studio` until a self-service password-change endpoint is added).

## What you can do
- **Overview** — live counts: properties, bookings, customers, agents.
- **Properties** — add/edit any listing, publish/hide/mark sold or rented, delete, attach
  images/video/floor plans. Every write here is logged to the audit trail.
- **Bookings** — see every inspection request across all agents, confirm/cancel/complete.
- **Customers** — registered users, phone, saved-properties count, inquiry count.
- **Notifications** — send an in-app announcement to all customers or one specific customer
  (by ID, visible in the Customers tab). This does **not** send real SMS/WhatsApp/push —
  those need Twilio/WhatsApp Cloud API/FCM credentials added to the backend `.env` first.
- **Reports** — CSV/Excel/PDF export of properties, customers, bookings, generated live in
  your browser from current data.

## Provisioning an agent
There's no public agent sign-up — you create their account. Currently this is a direct API
call (`POST /api/admin/agents` with fullName/email/password/phone/commissionPct) since the
admin UI doesn't have an "Add Agent" screen yet. You can call it from the Swagger docs UI at
`/api/docs`, or ask for an "Add Agent" panel to be added to the portal.

## Audit trail
Every login, and every property create/update/delete/status-change, is recorded with who
did it and when. Currently viewable via `GET /api/admin/audit-logs` (Swagger UI or a REST
client) — not yet surfaced in the portal UI itself.

## Things that are genuinely not live yet
- Real payment processing (Wave, Stripe, Flutterwave, etc.) — needs your merchant credentials.
- Real SMS/WhatsApp/push dispatch — needs Twilio/Meta/FCM credentials.
- Cloud media storage — files upload to local disk on the server by default; add
  `CLOUDINARY_*` to `.env` to switch.
