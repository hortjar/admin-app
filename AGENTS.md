# Universal Admin & Auth Server — Agent Guide

Shared identity provider + admin console for self-hosted apps. See `README.md` for the
full overview; this file is the canonical working reference for agents.

## Stack & layout

- pnpm monorepo. Backend: **Elysia on Bun** + **Postgres/Drizzle**. Frontend: **Vite + React**.
- `apps/server` — API + serves the built SPA on **:9000**.
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
pnpm db:up && pnpm migrate                     # Postgres :9002 + schema
pnpm dev                                        # server :9000 + SPA :9001
pnpm --filter @universal-admin/server generate # regenerate Drizzle migration after schema edits
pnpm generate:api                               # hey-api client from the live spec (server must be up)
pnpm -r lint                                    # typecheck all packages
```

## Never work around a failure

> **Fix the cause. If you broke it, you fix it.**

A failing check is information; suppressing it removes your ability to find the
defect. Never do any of these to make something pass:

- `eslint-disable` in any form, turning a rule to `"off"`/`"warn"`, raising
  `--max-warnings`, or adding files to an ignore list
- `@ts-ignore`, `@ts-expect-error`, `any`, `as unknown as X`, or `!`
- deleting, skipping or commenting out a test
- loosening a compiler flag
- `catch {}` or `.catch(() => {})` that swallows an error — if a failure really is
  ignorable, log it and say why

**"It was already broken" is not permission to hide it.** Say that it predates your
change, then fix it or report it. If a rule genuinely is wrong, leave it failing and
explain why — changing it is a deliberate commit of its own, never an inline disable.

**Report honestly.** Never call work complete when a check is failing, was skipped, or
was made to pass by suppression.

## Conventions

- `noUncheckedIndexedAccess` is on: `const [row] = await db…; row?.field ?? fallback`.
  Never destructure `const [{ x }] = …` from a query result.
- Don't interpolate a JS `Date` into a raw drizzle `sql\`\`` template — pass
  `.toISOString()`. Drizzle operators (`gte`, `lte`) accept `Date` fine.
- Admin routes live under `/api/admin/*` behind the `requireAdmin` / `requireSuperadmin`
  macros in `middleware/auth.ts`. Service endpoints (log ingest) use `requireApiKey`.
- Every privileged mutation calls `recordAudit(...)`.

## Downstream integration

`file-sync` and `checklists` each have an `AUTH_MODE=local|universal` switch. (The
`checklists` repo registers here under the app slug `ford-focus-checklist` — the slug
is the `aud` claim and did not change when the directory was renamed.)
In universal mode they verify tokens via JWKS, JIT-provision a local user, and proxy
auth endpoints here. The reusable version is `packages/auth-client`.
