import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the universal server during development.
      "/api": "http://localhost:9000",
      "/oauth": "http://localhost:9000",
      "/.well-known": "http://localhost:9000",
    },
  },
  build: {
    outDir: "dist",
  },
});
