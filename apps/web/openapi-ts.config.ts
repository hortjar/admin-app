import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates a fully-typed client from the running server's OpenAPI document.
 * Start the server (`pnpm dev:server`) then run `pnpm generate:api`.
 * Output lands in src/api/generated and is git-ignored.
 */
export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:9000/openapi/json",
  output: {
    path: "src/api/generated",
    format: "prettier",
  },
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/schemas",
    "@hey-api/sdk",
    "@hey-api/typescript",
    "@tanstack/react-query",
  ],
});
