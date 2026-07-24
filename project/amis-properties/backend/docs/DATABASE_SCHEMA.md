# AMI'S PROPERTIES — Database Schema Reference

Full source of truth is `prisma/schema.prisma`. This is a plain-English map of it.
Run `npm run prisma:studio` for a live, browsable view of the actual data.

## Identity & Access
| Table | Purpose |
|---|---|
| `User` | Everyone — customers, agents, admins. `role` field gates access. Tracks `failedLoginAttempts`/`lockedUntil` for account lockout. |
| `Agent` | One-to-one extension of `User` for staff who sell/manage listings — commission %, bio, availability. |
| `Session` / `RefreshToken` | Device sessions and refresh-token rotation for JWT auth. |
| `OtpCode` | Short-lived hashed OTP codes for phone verification (never stored in plain text). |

## Locations
`Country` → `State` → `City` — a simple three-level hierarchy properties attach to.

## Properties
| Table | Purpose |
|---|---|
| `Property` | The core listing — price, type, purpose, status, specs, coordinates. |
| `PropertyImage` / `PropertyVideo` / `FloorPlan` | Media attached to a listing. |
| `Category` / `Amenity` | Tagging/filtering metadata. |
| `Favorite` / `RecentlyViewed` | Per-customer saved/viewed listings. |

## Transactions & Engagement
| Table | Purpose |
|---|---|
| `Booking` | Inspection scheduling, status-tracked (pending → confirmed → completed/cancelled). |
| `Offer` | A customer's price offer on a listing. |
| `Conversation` / `Message` | Real-time chat, scoped to one property + one customer + one agent. |
| `Review` | Ratings/comments on a property or agent. |
| `Notification` | In-app notification queue (email/SMS/push channels are modeled but need real provider credentials to dispatch — see README). |

## Money
| Table | Purpose |
|---|---|
| `Payment` / `Invoice` | Modeled and ready, but **no live payment gateway is wired in** — these tables exist for when you connect one. |

## Content & Operations
| Table | Purpose |
|---|---|
| `Blog`, `NewsletterSubscriber` | Simple CMS/marketing tables. |
| `SupportTicket` | Customer support requests. |
| `AuditLog` | Who did what, when — populated on login and property create/update/delete/status-change. Extend this pattern to other sensitive actions as you add them. |
| `ActivityLog` | Lighter-weight per-user activity trail (modeled, not yet populated by any route — same extension pattern as AuditLog). |
| `Setting` | Generic key-value store — currently holds `company_info` (seeded), extendable for any other site config. |

## Relationships worth knowing
- A `Property` optionally belongs to one `Agent`, one `City`, one `Category`, and many `Amenity` rows (many-to-many).
- A `Conversation` is unique per `(propertyId, customerId)` pair — reopening a chat about the same property resumes the same thread.
- Deleting a `User` cascades to their sessions, tokens, favorites, bookings, messages, etc. (`onDelete: Cascade`) — deleting an `Agent` does not delete their `User` row.
