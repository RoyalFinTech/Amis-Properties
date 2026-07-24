# Production Readiness Report — AMI'S Properties

## Overall verdict
**Not yet production-ready as-is.** The foundation is real and substantially correct — this
is not a "start over" situation. Four specific fixes (H1–H4 in `PRIORITIZED_FINDINGS.md`)
should happen before real users touch this, plus a short list of "should do before launch,
can follow shortly after" items. Nothing found requires an architecture change.

## Go / No-Go checklist

### Must fix before launch (blocks go-live)
- [x] **H1** — ownership check added to `PATCH /properties/:id` and `/properties/:id/status`
- [x] **H2** — ownership check added to `PATCH /bookings/:id/status`
- [x] **H3** — refresh-token rotation now validates against storage and revokes on use; real `/api/auth/logout` added
- [x] **H4** — Zod validation added to property create/update; `agentId` now derived server-side
- [ ] Run `npx prisma migrate dev` against a real database at least once and confirm it succeeds — this has never been executed in this environment
- [ ] Add `directUrl` to `schema.prisma` if deploying to Supabase (see Supabase Postgres Readiness report)
- [ ] Change the seeded admin password (`ChangeMe123!`) immediately after first deploy
- [ ] Generate real `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` values (`openssl rand -base64 48`) — do not deploy with the placeholder text from `.env.example`

### Should fix before launch (real gaps, lower urgency than above)
- [ ] M1/M2/M3 — sanitize upload filenames, note the MIME-check limitation, consider serving `/uploads` with safer headers
- [ ] Decide whether reviews and the customer notifications inbox are in scope for launch — currently backend-incomplete and frontend-missing respectively
- [ ] Decide whether a property-approval workflow is needed, or whether agent-published-directly is the intended model
- [x] M5 — account lockout now also revokes all active refresh tokens for that user
- [ ] L6 (new) — staff logins issue an unused refresh token that neither portal ever reads; decide whether to stop issuing one or start using it

### Can follow shortly after launch
- [ ] Accessibility pass (aria-labels, focus states, keyboard navigation) — currently minimal
- [ ] Pagination on booking/lead/message-history endpoints
- [ ] API versioning if you anticipate breaking changes
- [ ] Structured logging + monitoring integration
- [ ] `npm audit` as a CI step
- [ ] Real Role/Permission enforcement, or remove the unused tables

### Explicitly out of scope until you provide credentials
- Real payment gateway (tell me which provider you actually have a merchant account with)
- Real SMS/WhatsApp/push notification dispatch (Twilio / WhatsApp Cloud API / FCM)
- Cloud media storage (Cloudinary keys)
- Email verification / transactional email (SMTP credentials)

## Release Notes — this audit pass

**Added:**
- Real OpenStreetMap integration on property detail (no API key required)
- Documentation set: database schema reference, per-role user guides, and this full audit report set
- **Fixed H1**: agents can no longer edit or change the status of another agent's property
- **Fixed H2**: agents can no longer change the status of another agent's booking; this endpoint now also writes to the audit log (previously it didn't)
- **Fixed H3**: refresh tokens are now single-use and validated against storage on rotation; added a real `POST /api/auth/logout`; account lockout now also revokes all of that user's active sessions
- **Fixed H4**: property create/update now validated with Zod; `agentId` is derived server-side for agents instead of trusted from the request body
- Customer app's logout button now calls the real logout endpoint to revoke its refresh token server-side, not just clear local storage

**Found, not yet fixed** (see `PRIORITIZED_FINDINGS.md` for the complete list):
- 7 Medium-severity issues (file upload hardening, Supabase connection config, versioning, etc.)
- 6 Low-severity issues (dead code, missing indexes-to-verify, CORS scope, an orphaned staff refresh token found while fixing H3)
- 5 Informational notes (things confirmed working correctly)

**Explicitly not changed this pass beyond the four High findings:** no other working feature
was modified or removed.

## What "Not verified" means throughout these reports
Anywhere a report says "not verified," it means: this environment has no network access and
no live database, so I could not run the code, connect to Supabase, execute `npm install`,
generate a migration, or measure real performance. Every such item is a real open question,
not a disguised assumption — treat those specifically as "needs to be checked once you have
a live environment," not as either "confirmed fine" or "confirmed broken."
