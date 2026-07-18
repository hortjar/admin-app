import type {
  AppDto,
  AppGrant,
  AuditLogDto,
  LogDto,
  LogLevel,
  SessionDto,
  UserDto,
} from "@universal-admin/shared";

import type { AppRow, AuditLogRow, LogRow, SessionRow, UserRow } from "../db";

export function toUserDto(user: UserRow, apps: AppGrant[] = []): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as UserDto["role"],
    disabled: user.disabled,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    apps,
  };
}

export function toAppDto(app: AppRow): AppDto {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    allowedOrigins: app.allowedOrigins,
    availableRoles: app.availableRoles,
    availablePermissions: app.availablePermissions,
    disabled: app.disabled,
    createdAt: app.createdAt.toISOString(),
  };
}

export function toSessionDto(session: SessionRow, currentTokenHash?: string): SessionDto {
  return {
    id: session.id,
    userId: session.userId,
    app: session.app,
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
    current: currentTokenHash !== undefined && session.tokenHash === currentTokenHash,
  };
}

export function toLogDto(log: LogRow): LogDto {
  return {
    id: log.id,
    app: log.app,
    level: log.level as LogLevel,
    message: log.message,
    requestId: log.requestId,
    userId: log.userId,
    context: log.context,
    timestamp: log.timestamp.toISOString(),
  };
}

export function toAuditDto(row: AuditLogRow): AuditLogDto {
  return {
    id: row.id,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}
