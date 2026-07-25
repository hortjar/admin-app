# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file starts at 0.2.0. For anything earlier, see the git history.

## [0.2.0] - 2026-07-25

### ⚠️ BREAKING — ports pinned to the 9000 block

This app is the identity provider for the other self-hosted apps, so its port is
load-bearing: downstream apps point `UNIVERSAL_AUTH_URL` at it.

| What                     | Old    | New    |
| ------------------------ | ------ | ------ |
| API                      | `9000` | `9000` (unchanged) |
| Web dev server (Vite)    | `5173` | `9001` |
| Postgres, host-published | `5433` | `9002` |

**The API did not actually move.** `env.ts`, `.env.example`, the `Dockerfile` and
`docker-compose.yml` were already on 9000 — only `README.md` and `AGENTS.md` claimed
9200, and the Vite proxy at `localhost:9000` was correct all along. The docs are now
consistent with the code.

Postgres and the dev server did move. **Container-internal Postgres is still 5432**;
only the host-published side became 9002. Downstream apps should keep
`UNIVERSAL_AUTH_URL=http://localhost:9000`.

### Fixed

- **`prefer-nullish-coalescing` was erroring at file level** on `eslint.config.ts` and
  `drizzle.config.ts`, reporting that it "requires `strictNullChecks`". The cause was
  `allowDefaultProject` placing those files in typescript-eslint's *inferred* project,
  which has no strict options. Fixed structurally — a root `tsconfig.json`,
  `drizzle.config.ts` added to the server's `include`, and `allowDefaultProject`
  removed — rather than by silencing the rule.
- **Empty `.catch(() => {})` swallows** in `lib/audit.ts` and `middleware/auth.ts` now
  log at `warn` instead of discarding the failure. Fire-and-forget semantics kept.
- `COOKIE_DOMAIN` used `||` to map `""` to `undefined`; that is now an explicit
  `optionalOrUndefined()` helper so the behaviour is deliberate rather than incidental.

### Changed

- `@hortjar/eslint-config` upgraded to `0.3.0`, and all 91 resulting lint problems
  fixed at their cause — no rule disabled, nothing added to an ignore list.
- `AuthContext.tsx` split: the context and `useAuth` moved to `auth/context.ts` so the
  module only exports components, satisfying React Fast Refresh.
- Added `@types/node` as a root devDependency so `import.meta.dirname` resolves.

### Known gaps

- `pnpm format:check` fails on 37 files, and did so before this release. Not addressed
  here: a repo-wide reformat would rewrite blame across the project and belongs in its
  own commit.
