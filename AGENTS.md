# Universal Admin & Auth Server — Agent Guide

Shared identity provider + admin console for self-hosted apps. See `README.md` for the
full overview; this file is the canonical working reference for agents.

## Stack & layout

- pnpm monorepo. Backend: **Elysia on Bun** + **Postgres/Drizzle**. Frontend: **Vite + React**.
- `apps/server` — API + serves the built SPA on **:9200**.
- `apps/web` — React admin SPA (TanStack Query, shadcn/ui, react-router, hey-api client).
- `packages/shared` — types shared across server/web/auth-client. **Build it first** (`tsc`).
- `packages/auth-client` — Elysia plugin + JWKS verifier + log shipper for downstream apps.

## Auth model (important)

- The server is an IdP. Access tokens are **RS256**, signed with a DB-stored private key,
  verified by anyone via `/.well-known/jwks.json`. Never a shared HMAC secret.
- Tokens are **audience-scoped**: `aud` = the app slug. The `apps` claim carries that
  app's roles + permissions (see `services/grants.ts`).
- Refresh tokens are opaque, hashed at rest (`sessions` table), and **rotated** on refresh.
- Admins/superadmins are implicitly granted an app's full declared roles/permissions
  even without an explicit membership row.
- `verifyAccessToken` verifies with the **public** JWKS (`getLocalJwkSet`), not the
  private key — a subtle but critical detail if you touch `lib/jwt.ts` / `lib/keys.ts`.

## Commands

```bash
pnpm install
pnpm --filter @universal-admin/shared build   # required before typechecking server/web
pnpm db:up && pnpm migrate                     # Postgres :5433 + schema
pnpm dev                                        # server :9200 + SPA :5173
pnpm --filter @universal-admin/server generate # regenerate Drizzle migration after schema edits
pnpm generate:api                               # hey-api client from the live spec (server must be up)
pnpm -r lint                                    # typecheck all packages
```

## Conventions

- `noUncheckedIndexedAccess` is on: `const [row] = await db…; row?.field ?? fallback`.
  Never destructure `const [{ x }] = …` from a query result.
- Don't interpolate a JS `Date` into a raw drizzle `sql\`\`` template — pass
  `.toISOString()`. Drizzle operators (`gte`, `lte`) accept `Date` fine.
- Admin routes live under `/api/admin/*` behind the `requireAdmin` / `requireSuperadmin`
  macros in `middleware/auth.ts`. Service endpoints (log ingest) use `requireApiKey`.
- Every privileged mutation calls `recordAudit(...)`.

## Downstream integration

`file-sync` and `ford-focus-checklist` each have an `AUTH_MODE=local|universal` switch.
In universal mode they verify tokens via JWKS, JIT-provision a local user, and proxy
auth endpoints here. The reusable version is `packages/auth-client`.
