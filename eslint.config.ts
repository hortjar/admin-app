import { base, defineConfig, elysia, react } from "@hortjar/eslint-config"

export default defineConfig(
  base({
    strictness: "recommended",
    tsconfigRootDir: import.meta.dirname,
  }),
  react({ files: ["apps/web/**/*.{ts,tsx}", "packages/auth-client/**/*.{ts,tsx}"] }),
  elysia({ files: ["apps/server/**/*.ts"], runtime: "bun" }),
)
