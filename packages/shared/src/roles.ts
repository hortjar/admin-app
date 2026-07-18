/**
 * Global roles a user can hold on the universal admin server itself.
 * These govern access to the admin console — *not* per-app privileges.
 * Per-app roles/permissions live on the `membership` records.
 */
export const GLOBAL_ROLES = ["superadmin", "admin", "user"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

/** Roles that may access the admin console. */
export const ADMIN_ROLES: GlobalRole[] = ["superadmin", "admin"];

export function isAdminRole(role: string): role is "superadmin" | "admin" {
  return role === "superadmin" || role === "admin";
}
