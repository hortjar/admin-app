import type { LogEntryInput } from "@universal-admin/shared";

import type { UniversalAuthConfig } from "./config.js";

export interface LogShipperOptions {
  /** Max entries buffered before an eager flush. */
  batchSize?: number;
  /** Flush interval in ms. */
  flushIntervalMs?: number;
  /** Called if shipping fails, for local diagnostics. */
  onError?: (error: unknown) => void;
}

/**
 * Buffers log entries and ships them to the universal server in batches using
 * the app's API key. Non-blocking and failure-tolerant: if the collector is
 * down, entries are dropped rather than backing up the app.
 */
export class LogShipper {
  private buffer: LogEntryInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly endpoint: string;

  constructor(
    private readonly config: UniversalAuthConfig,
    private readonly options: LogShipperOptions = {},
  ) {
    this.endpoint = `${config.serverUrl}/api/logs`;
  }

  start(): this {
    if (this.timer || !this.config.apiKey) return this;
    this.timer = setInterval(() => void this.flush(), this.options.flushIntervalMs ?? 5000);
    // Best-effort flush on shutdown.
    process.once("beforeExit", () => void this.flush());
    return this;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  ship(entry: LogEntryInput): void {
    if (!this.config.apiKey) return;
    this.buffer.push(entry);
    if (this.buffer.length >= (this.options.batchSize ?? 50)) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.apiKey) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.config.apiKey },
        body: JSON.stringify(batch),
      });
    } catch (error) {
      this.options.onError?.(error);
    }
  }
}
