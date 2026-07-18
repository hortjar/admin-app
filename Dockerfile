# syntax=docker/dockerfile:1

# ─── Stage 1: build the admin SPA + shared packages ────────────────────────────
FROM oven/bun:1.3 AS build
WORKDIR /app

# Install with the full workspace so workspace deps resolve.
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps

# Use corepack pnpm for the install (workspace-aware), Bun for runtime.
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
RUN pnpm install --frozen-lockfile || pnpm install

# Build shared types + the SPA.
RUN pnpm --filter @universal-admin/shared build
RUN pnpm --filter @universal-admin/web build

# ─── Stage 2: runtime (Bun serves API + built SPA on one port) ─────────────────
FROM oven/bun:1.3 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
ENV PORT=9000

RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
RUN pnpm --filter @universal-admin/shared build

# Bring in the built SPA from stage 1.
COPY --from=build /app/apps/web/dist ./public

EXPOSE 9000
# Run migrations then start the server.
CMD ["sh", "-c", "bun run apps/server/src/db/migrate.ts && bun run apps/server/src/index.ts"]
