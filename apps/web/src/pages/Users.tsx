import { KeyRound, Plus, Search, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/api/http";
import {
  useApps,
  useCreateUser,
  useDeleteUser,
  useResetPassword,
  useSetMembership,
  useUpdateUser,
  useUsers,
} from "@/api/hooks";
import type { AppDto, UserDto } from "@/api/types";
import { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, labelize } from "@/lib/utils";

export function UsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useUsers({ search, limit: 100 });
  const { data: apps } = useApps();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Derive the edited user from live query data so it re-renders after a
  // mutation (enable/disable, role, membership) without needing a page refresh.
  const editing = editingId ? (data?.items.find((u) => u.id === editingId) ?? null) : null;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage identities, global roles and per-app privileges"
        action={<CreateUserDialog />}
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {data && <span className="text-sm text-muted-foreground">{data.total} users</span>}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Apps</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.email}</div>
                  {u.displayName && <div className="text-xs text-muted-foreground">{u.displayName}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "superadmin" ? "default" : u.role === "admin" ? "warning" : "secondary"}>
                    {labelize(u.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.apps.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {u.apps.map((a) => (
                      <Badge key={a.app} variant="outline">
                        {labelize(a.app)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {u.disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="success">Active</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(u.lastLoginAt)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(u.id)}>
                    <UserCog className="h-4 w-4" /> Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <ManageUserDialog user={editing} apps={apps ?? []} onClose={() => setEditingId(null)} />
      )}
    </div>
  );
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", role: "user" });
  const create = useCreateUser();

  async function submit() {
    try {
      await create.mutateAsync(form);
      toast.success("User created");
      setOpen(false);
      setForm({ email: "", password: "", displayName: "", role: "user" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Add a new identity to the shared directory.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Global role</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageUserDialog({ user, apps, onClose }: { user: UserDto; apps: AppDto[]; onClose: () => void }) {
  const update = useUpdateUser();
  const reset = useResetPassword();
  const del = useDeleteUser();
  const [newPassword, setNewPassword] = useState("");

  async function toggleDisabled() {
    await update.mutateAsync({ id: user.id, disabled: !user.disabled });
    toast.success(user.disabled ? "User enabled" : "User disabled");
  }

  async function changeRole(role: string) {
    await update.mutateAsync({ id: user.id, role });
    toast.success("Role updated");
  }

  async function doReset() {
    if (newPassword.length < 8) return toast.error("Password must be ≥ 8 chars");
    await reset.mutateAsync({ id: user.id, password: newPassword });
    setNewPassword("");
    toast.success("Password reset — sessions revoked");
  }

  async function doDelete() {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(user.id);
      toast.success("User deleted");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user.email}</DialogTitle>
          <DialogDescription>Manage global role, per-app privileges, and credentials.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Global role</div>
              <div className="text-xs text-muted-foreground">Controls admin console access</div>
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={user.role}
              onChange={(e) => changeRole(e.target.value)}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Account enabled</div>
              <div className="text-xs text-muted-foreground">Disabling revokes all sessions</div>
            </div>
            <Switch checked={!user.disabled} onCheckedChange={toggleDisabled} />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Per-app privileges</div>
            <div className="space-y-3">
              {apps.map((app) => (
                <MembershipEditor key={app.id} user={user} app={app} />
              ))}
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">Reset password</div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button variant="secondary" onClick={doReset} disabled={reset.isPending}>
                <KeyRound className="h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <Button variant="destructive" onClick={doDelete}>
            <Trash2 className="h-4 w-4" /> Delete user
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembershipEditor({ user, app }: { user: UserDto; app: AppDto }) {
  const grant = user.apps.find((a) => a.app === app.slug);
  const setMembership = useSetMembership();
  const [roles, setRoles] = useState<string[]>(grant?.roles ?? []);
  const [perms, setPerms] = useState<string[]>(grant?.permissions ?? []);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function save() {
    await setMembership.mutateAsync({ userId: user.id, appId: app.id, roles, permissions: perms });
    toast.success(`Updated ${app.name} privileges`);
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{app.name}</span>
        <Button size="sm" variant="secondary" onClick={save} disabled={setMembership.isPending}>
          Save
        </Button>
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <div className="mb-1 text-muted-foreground">Roles</div>
          <div className="flex flex-wrap gap-1">
            {app.availableRoles.length === 0 && <span className="text-muted-foreground">none declared</span>}
            {app.availableRoles.map((r) => (
              <button
                key={r}
                onClick={() => toggle(roles, setRoles, r)}
                className={`rounded-md border px-2 py-0.5 ${roles.includes(r) ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {labelize(r)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-muted-foreground">Permissions</div>
          <div className="flex flex-wrap gap-1">
            {app.availablePermissions.length === 0 && <span className="text-muted-foreground">none declared</span>}
            {app.availablePermissions.map((p) => (
              <button
                key={p}
                onClick={() => toggle(perms, setPerms, p)}
                className={`rounded-md border px-2 py-0.5 ${perms.includes(p) ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {labelize(p)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
