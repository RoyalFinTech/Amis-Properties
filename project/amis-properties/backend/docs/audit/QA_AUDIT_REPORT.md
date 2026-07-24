# Complete QA Audit Report — AMI'S Properties

Verified by reading the actual frontend source (`app.html`, `admin-portal.html`,
`agent-portal.html`) and cross-checking every UI action against a real backend endpoint.
Where a feature calls a real API, it's marked accordingly; where I found it doesn't, that's
stated plainly rather than assumed to work.

## 4. Customer Portal

| Feature | Status | Note |
|---|---|---|
| Registration | ✅ Real | Phone+name → `POST /auth/otp/request` |
| Login | ✅ Real | Phone+PIN → `POST /auth/pin/login`, or full OTP flow for new devices |
| Profile | ✅ Real | `GET/PATCH /users/me` |
| Property search | ✅ Real | Full filter set hits `GET /properties` |
| Filters | ✅ Real | Keyword, type, purpose, price range, bedrooms, bathrooms |
| Property details | ✅ Real | `GET /properties/:slug`, increments view count server-side |
| Image gallery | ✅ Real, with a caveat | Renders real uploaded images if present; falls back to a styled gradient+icon panel if a property has none — this is intentional (see earlier onboarding-image fix), not a bug |
| Maps | ✅ Real (added this pass) | OpenStreetMap embed, no API key required, uses real lat/lng when the admin sets them |
| Favorites | ✅ Real | `POST/DELETE /favorites/:id`, reflected instantly in the UI |
| Reviews | ⚠️ Read-only, backend-wide | The `Review` table is included when fetching property detail (so existing reviews display correctly), but **no route exists anywhere in the backend to create one** — this isn't just a missing UI screen, there's no `POST` endpoint at all across the entire API. Confirmed by checking every route file. |
| Booking requests | ✅ Real | `POST /bookings` |
| Contact agent | ✅ Real | `tel:`/`wa.me` links use the property's real agent phone (or official number as fallback) |
| Chat | ✅ Real | Persists via `/conversations`, live via Socket.io |
| Notifications | ⚠️ Partial | In-app notifications are modeled and adminsendable, but the customer app has **no notifications inbox screen** to view them — `Notification` rows are created server-side but nothing in `app.html` fetches or displays them. **Genuine gap.** |
| Responsive design | ⚠️ Partial | Mobile-first, centers itself in a fixed-width frame on wider screens (one `min-width:560px` breakpoint) rather than adapting to a true multi-column desktop/tablet layout. Works correctly at any width, but doesn't "redesign" for larger screens. |
| Accessibility | ❌ Gap | Only 5 `aria-*` attributes in the entire file; no skip links, no visible focus-state audit performed, form fields rely on visual labels only. Does **not** meet WCAG AA as-is. |

## 5. Agent Portal

| Feature | Status | Note |
|---|---|---|
| Agent login | ✅ Real | Email/password → `/auth/staff/login` |
| Dashboard | ✅ Real | `/agent/stats` — listing counts, pending bookings, commission estimate |
| Property management | ✅ Real | Own listings only, correctly scoped |
| Upload property | ✅ Real | Full form, media upload |
| Edit/Delete property | ⚠️ See **H1** in Security report | Edit works but isn't ownership-enforced at the API level — the *portal UI* only shows your own listings, but the underlying endpoint doesn't stop you from editing someone else's if called directly. Delete is admin-only, correctly restricted. |
| Booking management | ⚠️ See **H2** | Same class of issue — UI only shows your leads, API doesn't enforce it on the general endpoint (the agent-specific `/agent/leads/...` endpoint *is* correctly scoped; it's the older general endpoint that isn't). |
| Customer messaging | ✅ Real | Real-time chat, correctly participant-scoped |
| Leads | ✅ Real | Bookings + offers on own properties |
| Reports | ✅ Real | CSV/Excel/PDF export, generated from live data |
| Analytics | ⚠️ Basic | Dashboard stats only — no charts/trends over time, just current counts |

## 6. Admin Portal

| Feature | Status | Note |
|---|---|---|
| Admin authentication | ✅ Real | Same staff login as agents, role-gated |
| Dashboard | ✅ Real | Live counts |
| User management | ⚠️ Read-only | Customer list is viewable; no suspend/delete/edit action exists in the UI or API |
| Agent management | ⚠️ Partial | Creating an agent works via direct API call, but **the admin portal UI has no "Add Agent" form** — documented as a known gap in `ADMIN_GUIDE.md` already |
| Property approval/moderation | ⚠️ Informal | There's no explicit "pending approval" workflow — any agent-created property is immediately live if they set status to AVAILABLE themselves; there's no separate admin approval gate before a listing goes public. If you want listings to require admin sign-off before publishing, that's a real feature gap, not currently modeled. |
| Audit logs | ⚠️ Backend only | Real data now exists (`GET /admin/audit-logs`), but **no screen in the admin portal UI displays it** — currently only reachable via a raw API call or Swagger UI. |
| Reports | ✅ Real | Same CSV/Excel/PDF pattern as agent portal |
| Analytics | ⚠️ Basic | Same as agent — current counts, no historical trends |
| Platform settings | ✅ Real | Server URL config; company info lives in a seeded `Setting` row but has no edit UI yet |
| Role management | ❌ Not implemented | `Role`/`Permission` tables exist in the schema but are never queried anywhere — see Database Audit Report. Role is a fixed enum on `User`, not a manageable set of permissions. |

## 7. Property System

| Feature | Status | Note |
|---|---|---|
| Property CRUD | ✅ Real, with H1/H4 caveats above | |
| Categories | ✅ Real | `Category` table, used in filtering |
| Status (Available/Sold/Rented/etc.) | ✅ Real | Full status enum enforced |
| Pricing | ✅ Real | Decimal-typed, currency field |
| Location | ✅ Real | City → State → Country hierarchy |
| Map integration | ✅ Real (this pass) | See Customer Portal section above |
| Gallery uploads | ✅ Real | Multer-backed, local disk (Cloudinary hook inactive) |
| Amenities | ✅ Real | Many-to-many, tag-style |
| Search indexing | ⚠️ Basic | Uses Postgres `ILIKE`/`contains` via Prisma, not a dedicated search index (e.g. Postgres full-text search or Elasticsearch). Fine at current scale; would need real indexing for large catalogs. |

## Dead/unfinished elements found
- Reviews can be read but not submitted through the real app (customer portal gap above).
- Notifications are sent but never displayed to the customer.
- `Role`/`Permission` tables are fully unused dead schema.
- No property-approval workflow despite "Property Moderation" being requested — worth
  clarifying whether you want one before building it, since it changes the publish flow.
