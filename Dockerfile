# syntax=docker/dockerfile:1

# ─── Stage 1: install + build (bun-only; the bun image has no Node/corepack) ────
FROM oven/bun:1.3 AS build
WORKDIR /app

# Copy the whole workspace so bun resolves workspace packages during install.
COPY package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN bun install

# Build shared types, then the admin SPA.
RUN bun run --cwd packages/shared build
RUN bun run --cwd apps/web build

# ─── Stage 2: runtime (Bun serves API + built SPA on one port) ─────────────────
FROM oven/bun:1.3 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
ENV PORT=9000

# Carry over installed deps + workspace sources (workspace symlinks stay valid
# because node_modules and packages land at the same relative paths).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
# Built SPA served as static files.
COPY --from=build /app/apps/web/dist ./public

EXPOSE 9000
# Run migrations then start the server.
CMD ["sh", "-c", "bun run apps/server/src/db/migrate.ts && bun run apps/server/src/index.ts"]
