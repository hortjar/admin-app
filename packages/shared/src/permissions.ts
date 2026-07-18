/**
 * Per-app roles and permissions are free-form strings so each downstream app
 * can define its own scheme (e.g. "editor", "viewer", "checklists:write").
 * The universal server stores them as arrays on each membership and embeds
 * them into the audience-scoped access token it issues for that app.
 */
export type AppRole = string;
export type Permission = string;

/**
 * The per-app authorization context that gets embedded in an access token
 * (claim `apps`) and exposed to downstream apps after verification.
 */
export interface AppGrant {
  /** Stable app slug, e.g. "file-sync". Matches the token audience. */
  app: string;
  roles: AppRole[];
  permissions: Permission[];
}
