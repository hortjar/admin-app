import type { AppGrant } from "./permissions.js";
import type { GlobalRole } from "./roles.js";
import type { LogLevel } from "./logs.js";

export interface UserDto {
  id: string;
  email: string;
  displayName: string | null;
  role: GlobalRole;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  apps: AppGrant[];
}

export interface AppDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Allowed token audiences / redirect origins. */
  allowedOrigins: string[];
  /** Role/permission vocabulary the app declares (for the admin UI pickers). */
  availableRoles: string[];
  availablePermissions: string[];
  disabled: boolean;
  createdAt: string;
}

export interface ApiKeyDto {
  id: string;
  appId: string;
  name: string;
  /** Only the prefix is ever returned after creation. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface SessionDto {
  id: string;
  userId: string;
  app: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

export interface LogDto {
  id: string;
  app: string;
  level: LogLevel;
  message: string;
  requestId: string | null;
  userId: string | null;
  context: Record<string, unknown> | null;
  timestamp: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}
