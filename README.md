# Universal Admin & Auth Server

A single **identity provider + administration console** for your self-hosted apps.
Users authenticate once here; every app trusts the tokens it issues. From one place
you manage users, per-app roles & permissions, sessions, API keys, and collected logs.

- **Backend** — Elysia (Bun) + PostgreSQL (Drizzle ORM), RS256 JWTs published via JWKS.
- **Frontend** — Vite + React + TypeScript SPA, TanStack Query, shadcn/ui.
- **API client** — generated from the live OpenAPI spec with [hey-api](https://heyapi.dev).
- **Deploy** — one container on **:9200** (API + SPA) + Postgres, via Docker Compose / Portainer.
- **Monorepo** — pnpm workspaces.

```
apps/
  server/   Elysia API + serves the built SPA (port 9200)
  web/      React admin SPA
packages/
  shared/       shared TS types (roles, permissions, DTOs, token claims)
  auth-client/  drop-in Elysia plugin + log shipper for downstream apps
```

## How shared auth works

The server is an **OpenID-style IdP**. It signs access tokens with an RS256 private key
and publishes the public keys at `/.well-known/jwks.json`.

1. A downstream app sends the user's credentials to `POST /api/auth/login` with its
   `app` slug (the token **audience**).
2. The server returns an **access token** (15 min, RS256) + a rotating **refresh token**.
   The access token embeds the user's **per-app roles and permissions** for that audience.
3. The downstream app verifies the access token **locally** against the JWKS — no
   round-trip per request — so all of its own routes keep working exactly as before.
   It may optionally call `POST /oauth/introspect` to check live revocation.

```
┌──────────┐   login (app=file-sync)   ┌─────────────────────┐
│ file-sync│ ────────────────────────► │  Universal Admin     │
│  backend │ ◄──── access+refresh ───── │  (IdP + console)     │
└────┬─────┘                            │  signs RS256, JWKS   │
     │ verify token via JWKS  ◄──────── │  /.well-known/jwks   │
     ▼                                  └─────────────────────┘
  its own routes keep working
```

### Token claims

```jsonc
{
  "iss": "http://localhost:9200",
  "sub": "<user id>",
  "aud": "file-sync",            // the app this token is for
  "email": "alice@example.com",
  "role": "user",                // global role on the admin server
  "apps": [                      // per-app grants for the audience
    { "app": "file-sync", "roles": ["user"], "permissions": ["sync:write"] }
  ],
  "typ": "access", "iat": 0, "exp": 0, "jti": "…"
}
```

## Quick start (local dev)

```bash
pnpm install
pnpm --filter @universal-admin/shared build     # build shared types
cp .env.example .env                             # then edit as needed
pnpm db:up                                        # Postgres on :5433 (docker)
pnpm migrate                                       # create tables
pnpm dev                                           # server :9200 + SPA :5173
```

Log into the SPA with the bootstrap admin from your `.env`
(`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`). **Change the password immediately.**

Regenerate the typed API client any time the server is running:

```bash
pnpm generate:api        # hey-api → apps/web/src/api/generated
```

## Deploying with Portainer

The `docker-compose.yml` builds a single image that serves the API and the built SPA
on **:9200**, alongside a Postgres service. In Portainer, create a stack from the compose
file and set these environment variables:

| Variable | Purpose |
| --- | --- |
| `ISSUER` | Public URL (e.g. `https://auth.example.com`) — becomes the JWT `iss` |
| `POSTGRES_PASSWORD` | Database password |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | First super-admin |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SIGNING_KEY_PEM_BASE64` | *(optional)* pin the RS256 key across DB resets |

The container runs migrations on start and generates a signing key on first boot.

## Connecting a downstream app

Each app has an `AUTH_MODE` switch. `local` = the app's own auth (unchanged);
`universal` = delegate to this server. Set these env vars on the app:

```bash
AUTH_MODE=universal
UNIVERSAL_AUTH_URL=http://localhost:9200
UNIVERSAL_AUTH_APP=file-sync          # must match the app slug registered here
# For log shipping (create an API key in the console → Apps → Manage):
UNIVERSAL_AUTH_API_KEY=uak_xxx.xxxxxxxx
```

In universal mode the app:
- verifies access tokens against the JWKS (scoped to its audience),
- **just-in-time provisions** a local user row on first sight, so every existing
  route that keys off a local user id keeps working, and
- proxies `login` / `register` / `refresh` / `logout` to this server.

`file-sync` and `ford-focus-checklist` are already wired this way — see
`packages/auth-client` for the reusable plugin and log shipper.

## Single sign-on across subdomains

Log in once, and every app under a shared parent domain is authenticated — no
per-app login. This works via a cookie scoped to the parent domain (`localStorage`
can't be shared across origins; a `Domain=.hortjar.cz` cookie is sent to all
`*.hortjar.cz` subdomains).

On login the server issues the refresh token as an **`HttpOnly; Secure; SameSite=Lax`
cookie** scoped to `COOKIE_DOMAIN`. Any app under that domain calls `POST
/api/auth/refresh` **with an empty body** (`credentials: "include"`) on startup — the
shared cookie is present, so it gets a fresh access token silently. The refresh token
rotates on every use and never touches JavaScript (XSS-safe, unlike `localStorage`).

```
COOKIE_DOMAIN=.hortjar.cz
COOKIE_SECURE=true                 # requires HTTPS
CORS_ORIGINS=https://auth.hortjar.cz,https://filesync.hortjar.cz,https://checklist.hortjar.cz
```

Recommended topology: host the auth server at `auth.hortjar.cz` and have each app's
frontend do auth directly against it. The admin SPA already does silent SSO refresh;
the same ~10-line startup snippet applies to any frontend:

```ts
// on app startup, before rendering:
const r = await fetch("https://auth.hortjar.cz/api/auth/refresh", {
  method: "POST", credentials: "include",
  headers: { "content-type": "application/json" }, body: "{}",
});
if (r.ok) { const { accessToken } = await r.json(); /* keep in memory */ }
```

> Because it's now cookie-based, treat `/api/auth/refresh` as CSRF-relevant. `SameSite=Lax`
> covers cross-site requests; if you host untrusted sibling subdomains, add a double-submit
> CSRF token.

## Feature summary

- Users: CRUD, global roles, per-app roles/permissions, password reset, disable, delete.
- Apps: register apps, declare their role/permission vocabulary, per-app API keys.
- Sessions: list & revoke refresh-token sessions across all apps.
- Logs: batch ingestion (API key), searchable/filterable viewer, retention purge.
- Audit: every privileged action recorded.
- Security: RS256 + JWKS, refresh-token rotation, argon2id passwords, key rotation.
