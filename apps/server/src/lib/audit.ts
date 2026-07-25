import { database, auditLogs } from "../db";

import { logger } from "./logger";

export interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await database.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
    });
  } catch (error) {
    logger.warn({ err: error, action: input.action }, "Failed to record audit entry");
  }
}

/** Record a privileged action. Fire-and-forget; never blocks the request path. */
export function recordAudit(input: AuditInput): void {
  void writeAudit(input);
}
