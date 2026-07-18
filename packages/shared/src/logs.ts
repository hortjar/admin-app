/** Log levels, aligned with pino's numeric levels for easy shipping. */
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const PINO_LEVEL_TO_NAME: Record<number, LogLevel> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

/** A single structured log entry shipped by a downstream app. */
export interface LogEntryInput {
  level: LogLevel;
  message: string;
  /** ISO timestamp; defaults to server receive time when omitted. */
  timestamp?: string;
  /** Correlates entries from one request. */
  requestId?: string;
  /** The end-user this log relates to, if any. */
  userId?: string;
  /** Arbitrary structured context. */
  context?: Record<string, unknown>;
}
