import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "./http";
import type {
  ApiKeyDto,
  AppDto,
  AuditLogDto,
  LogDto,
  Paginated,
  SessionDto,
  Stats,
  UserDto,
} from "./types";

// ─── Stats ───────────────────────────────────────────────────────────────────
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => request<Stats>("/api/admin/stats"),
    refetchInterval: 30_000,
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────
export function useUsers(params: { search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => request<Paginated<UserDto>>("/api/admin/users", { query: params }),
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => request<UserDto>(`/api/admin/users/${id}`),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; displayName?: string; role?: string }) =>
      request<UserDto>("/api/admin/users", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; displayName?: string; role?: string; disabled?: boolean }) =>
      request<UserDto>(`/api/admin/users/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user", v.id] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      request(`/api/admin/users/${id}/reset-password`, { method: "POST", body: { password } }),
  });
}

export function useRevokeUserSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/admin/users/${id}/revoke-sessions`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useSetMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, appId, roles, permissions }: { userId: string; appId: string; roles: string[]; permissions: string[] }) =>
      request(`/api/admin/users/${userId}/memberships/${appId}`, {
        method: "PUT",
        body: { roles, permissions },
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["user", v.userId] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useRemoveMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, appId }: { userId: string; appId: string }) =>
      request(`/api/admin/users/${userId}/memberships/${appId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["user", v.userId] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

// ─── Apps ────────────────────────────────────────────────────────────────────
export function useApps() {
  return useQuery({ queryKey: ["apps"], queryFn: () => request<AppDto[]>("/api/admin/apps") });
}

export function useCreateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AppDto> & { slug: string; name: string }) =>
      request<AppDto>("/api/admin/apps", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apps"] }),
  });
}

export function useUpdateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AppDto> & { id: string }) =>
      request<AppDto>(`/api/admin/apps/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apps"] }),
  });
}

export function useAppKeys(appId: string | undefined) {
  return useQuery({
    queryKey: ["app-keys", appId],
    queryFn: () => request<ApiKeyDto[]>(`/api/admin/apps/${appId}/keys`),
    enabled: !!appId,
  });
}

export function useCreateAppKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, name }: { appId: string; name: string }) =>
      request<ApiKeyDto & { key: string }>(`/api/admin/apps/${appId}/keys`, {
        method: "POST",
        body: { name },
      }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["app-keys", v.appId] }),
  });
}

export function useRevokeAppKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, keyId }: { appId: string; keyId: string }) =>
      request(`/api/admin/apps/${appId}/keys/${keyId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["app-keys", v.appId] }),
  });
}

// ─── Logs ────────────────────────────────────────────────────────────────────
export function useLogs(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["logs", params],
    queryFn: () => request<Paginated<LogDto>>("/api/admin/logs", { query: params }),
    refetchInterval: 15_000,
  });
}

// ─── Sessions ────────────────────────────────────────────────────────────────
export function useSessions(userId?: string) {
  return useQuery({
    queryKey: ["sessions", userId],
    queryFn: () => request<SessionDto[]>("/api/admin/sessions", { query: { userId } }),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/api/admin/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

// ─── Audit ───────────────────────────────────────────────────────────────────
export function useAudit(params: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["audit", params],
    queryFn: () => request<Paginated<AuditLogDto>>("/api/admin/audit", { query: params }),
  });
}
