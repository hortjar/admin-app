import { buildApp } from "./app";
import { env } from "./env";
import { getKeys } from "./lib/keys";
import { logger } from "./lib/logger";
import { runBootstrap } from "./db/seed";

async function main() {
  // Ensure a signing key + bootstrap admin exist before accepting traffic.
  await getKeys();
  await runBootstrap();

  const app = buildApp();
  app.listen({ port: env.port, hostname: "0.0.0.0" });

  logger.info(`Universal Admin server listening on :${env.port} (issuer ${env.issuer})`);
  logger.info(`OpenAPI docs at ${env.issuer}/openapi`);
}

main().catch((error) => {
  logger.error({ err: error }, "Failed to start server");
  process.exit(1);
});
