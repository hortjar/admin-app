import { pino } from "pino";

import { isProduction } from "../env";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport: isProduction ? undefined : { target: "pino-pretty" },
});
