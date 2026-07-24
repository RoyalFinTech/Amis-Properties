# Supabase MCP Readiness Report

**Important scope clarification first:** "Supabase MCP" and "Supabase, the platform's
native features" are two different things, and this report covers both readings since the
request wasn't specific about which was meant.

## If this means "Supabase's own platform features" (Auth, Storage, Realtime, RLS, RPC)

**Verdict: not integrated at all. This is a scope gap, not a partial implementation.**

This backend is a self-hosted Express + Prisma API with its own JWT auth, its own file
handling, and its own Socket.io realtime layer. It does not use, and was never built to use,
Supabase's platform-native equivalents. Specifically, verified by reading the code:

| Supabase feature | Status | Evidence |
|---|---|---|
| **Auth** | Not used | Auth is custom JWT + bcrypt (`src/services/auth.service.ts`), not `supabase-js` or Supabase's GoTrue auth server. Migrating to Supabase Auth would mean replacing the entire auth module, not configuring an existing one. |
| **Storage** | Not used | File uploads go to local disk via Multer (`src/routes/media.routes.ts`), with an unimplemented Cloudinary TODO — no Supabase Storage bucket code exists anywhere. |
| **Realtime** | Not used | Chat uses a self-hosted Socket.io server (`src/index.ts`), not Supabase Realtime's Postgres-changes subscriptions. |
| **Row Level Security (RLS)** | Not used, and **would not currently work if enabled** | Prisma connects to the database with a single privileged connection string and performs its own authorization checks in application code (`requireAuth`/`requireRole` middleware). It does not set the Postgres session variables (`request.jwt.claims`, etc.) that Supabase RLS policies key off. If you enabled RLS on these tables today, Prisma's queries would either be blocked entirely or would need every table's RLS policy to allow the single service-role connection, which defeats the purpose of RLS as a security boundary — you'd be relying on the application-layer checks (already audited above) either way. |
| **RPC functions** | Not used | No `supabase.rpc()` calls or Postgres functions/triggers exist in this codebase; all business logic lives in the Node application layer. |

## If this means "the Supabase MCP server" (a Model Context Protocol server that lets an AI assistant query/manage a Supabase project directly)

**Not applicable to this codebase.** MCP servers are a tool-connection concern for whichever
AI assistant or IDE you're using — they let *you* (or an AI helping you) inspect/manage a
Supabase project interactively. They aren't something an application's source code
integrates with or needs to be "ready" for; there's no code-level readiness question here.
If you're trying to connect an MCP-enabled tool to your Supabase project for schema
inspection/management while working on this codebase, that's a local tooling setup step
(installing/configuring the MCP server against your Supabase credentials), not something
this repository's code affects one way or the other.

## Blockers, concretely
1. **RLS**: cannot be safely enabled without either (a) rewriting authorization to rely on
   Postgres-level policies keyed off a Supabase-issued JWT instead of this app's own JWT, or
   (b) explicitly designing RLS policies that permit the app's single database role,
   understanding that does *not* add a second layer of defense beyond what's already
   enforced in `requireAuth`/`requireRole` — it would be redundant, not additive, unless the
   auth model changes too.
2. **Auth/Storage/Realtime migration** would each be a genuine rewrite of a whole module, not
   a configuration change — sized more like "new feature work" than "readiness fix."

## Recommendation
If the goal is specifically "run on Supabase's infrastructure," the **Postgres readiness
report** (separate document) is what matters — that's a small, concrete fix. If the goal is
"use Supabase's Auth/Storage/Realtime/RLS instead of this app's own," that's a larger,
deliberate architecture decision worth discussing before starting, not something to fix as
an audit finding.
