// Mirrors @universal-admin/shared DTOs. Kept local so the SPA builds independently;
// `pnpm generate:api` (hey-api) produces the fully-typed client from the live spec.

export type GlobalRole = "superadmin" | "admin" | "user";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface AppGrant {
  app: string;
  roles: string[];
  permissions: string[];
}

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
  allowedOrigins: string[];
  availableRoles: string[];
  availablePermissions: string[];
  disabled: boolean;
  createdAt: string;
}

export interface ApiKeyDto {
  id: string;
  appId: string;
  name: string;
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

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface Stats {
  users: number;
  apps: number;
  activeSessions: number;
  logs24h: number;
  errors24h: number;
  logsByLevel: { app: string; level: LogLevel; count: number }[];
  recentAudit: AuditLogDto[];
}
