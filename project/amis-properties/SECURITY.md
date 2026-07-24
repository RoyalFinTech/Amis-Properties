# Security Policy — AMI'S Properties

## Reporting a vulnerability
Contact the project maintainer directly (do not open a public GitHub issue for undisclosed
vulnerabilities). Include steps to reproduce and, if possible, the affected file/endpoint.

## What's already been audited
This repository has been through a documented security audit — see
[`backend/docs/audit/SECURITY_AUDIT_REPORT.md`](docs/audit/SECURITY_AUDIT_REPORT.md) and
[`backend/docs/audit/PRIORITIZED_FINDINGS.md`](docs/audit/PRIORITIZED_FINDINGS.md) for the
full, evidence-based findings list, including what was found, fixed, and what remains open.

## Known, disclosed items — not surprises, tracked deliberately
- The seeded admin account (`prisma/seed.ts`) uses a placeholder password
  (`ChangeMe123!`) that **must** be changed immediately after first deploy.
- `.env.example` contains no real secrets — every value is a placeholder or blank.
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` must be generated fresh
  (`openssl rand -base64 48`) before any deployment; the app refuses to boot with a
  secret shorter than 16 characters, but a short *valid* secret is still weak — generate
  a real random one.
- Payment gateway, SMS/WhatsApp/push, and cloud storage credentials are not included and
  those integrations are inactive until you supply your own.
- File upload filename sanitization and MIME-type verification are known-incomplete —
  see finding M1/M2 in the Security Audit Report before accepting uploads from untrusted
  users in production.

## Authentication model
- Customers: phone + OTP + PIN (bcrypt-hashed), JWT access (15 min) + refresh (30 days,
  single-use rotation, revoked on logout or account lockout).
- Staff (agents/admins): email + password (bcrypt-hashed), same JWT scheme.
- Account lockout: 5 failed attempts locks the account for 15 minutes and revokes all of
  that account's active refresh tokens.

## Reporting scope
This is a real estate listing platform handling user contact details (phone, email) and
property data. It does not currently store payment card data or government ID numbers
anywhere in the schema.
