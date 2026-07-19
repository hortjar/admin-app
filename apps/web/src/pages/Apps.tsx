import { Copy, KeyRound, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/api/http";
import {
  useApps,
  useAppKeys,
  useCreateApp,
  useCreateAppKey,
  useRevokeAppKey,
  useUpdateApp,
} from "@/api/hooks";
import type { AppDto } from "@/api/types";
import { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, labelize } from "@/lib/utils";

export function AppsPage() {
  const { data: apps, isLoading } = useApps();
  const [manage, setManage] = useState<AppDto | null>(null);

  return (
    <div>
      <PageHeader
        title="Apps"
        description="Registered downstream apps, their privilege vocabulary and API keys"
        action={<CreateAppDialog />}
      />
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {apps?.map((app) => (
          <Card key={app.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {app.name}
                  {app.disabled && <Badge variant="destructive">Disabled</Badge>}
                </CardTitle>
                <code className="text-xs text-muted-foreground">{app.slug}</code>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setManage(app)}>
                <Settings2 className="h-4 w-4" /> Manage
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {app.description && <p className="text-muted-foreground">{app.description}</p>}
              <div className="flex flex-wrap gap-1">
                {app.availableRoles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {labelize(r)}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {app.availablePermissions.map((p) => (
                  <Badge key={p} variant="outline">
                    {labelize(p)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {manage && <ManageAppDialog app={manage} onClose={() => setManage(null)} />}
    </div>
  );
}

function CreateAppDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "", roles: "", permissions: "" });
  const create = useCreateApp();

  async function submit() {
    try {
      await create.mutateAsync({
        slug: form.slug,
        name: form.name,
        description: form.description,
        availableRoles: form.roles.split(",").map((s) => s.trim()).filter(Boolean),
        availablePermissions: form.permissions.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("App registered");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Register app
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register app</DialogTitle>
          <DialogDescription>Add a downstream app that delegates auth here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Slug (token audience)</Label>
            <Input placeholder="my-app" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles (comma-separated)</Label>
            <Input placeholder="user, admin" value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Permissions (comma-separated)</Label>
            <Input placeholder="read, write" value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending}>
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageAppDialog({ app, onClose }: { app: AppDto; onClose: () => void }) {
  const update = useUpdateApp();
  const { data: keys } = useAppKeys(app.id);
  const createKey = useCreateAppKey();
  const revokeKey = useRevokeAppKey();
  const [origins, setOrigins] = useState(app.allowedOrigins.join(", "));
  const [keyName, setKeyName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  async function saveOrigins() {
    await update.mutateAsync({
      id: app.id,
      allowedOrigins: origins.split(",").map((s) => s.trim()).filter(Boolean),
    });
    toast.success("Allowed origins saved");
  }

  async function toggleDisabled() {
    await update.mutateAsync({ id: app.id, disabled: !app.disabled });
    toast.success(app.disabled ? "App enabled" : "App disabled");
    onClose();
  }

  async function addKey() {
    if (!keyName) return;
    const res = await createKey.mutateAsync({ appId: app.id, name: keyName });
    setFreshKey(res.key);
    setKeyName("");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{app.name}</DialogTitle>
          <DialogDescription>Configure origins and manage service API keys.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Allowed origins (comma-separated)</Label>
            <div className="flex gap-2">
              <Input value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="https://app.example.com" />
              <Button variant="secondary" onClick={saveOrigins}>
                Save
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              <span className="text-sm font-medium">API keys</span>
            </div>
            {freshKey && (
              <div className="mb-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                <div className="mb-1 font-medium">Copy this key now — it won't be shown again:</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">{freshKey}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(freshKey);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="mb-3 flex gap-2">
              <Input placeholder="Key name (e.g. prod-log-shipper)" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              <Button onClick={addKey} disabled={createKey.isPending}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </div>
            <div className="space-y-1">
              {keys?.length === 0 && <p className="text-sm text-muted-foreground">No keys yet.</p>}
              {keys?.map((k) => (
                <div key={k.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{k.name}</span>{" "}
                    <code className="text-xs text-muted-foreground">uak_{k.prefix}…</code>
                    {k.revokedAt && <Badge variant="destructive" className="ml-2">revoked</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>used {formatDate(k.lastUsedAt)}</span>
                    {!k.revokedAt && (
                      <Button variant="ghost" size="sm" onClick={() => revokeKey.mutate({ appId: app.id, keyId: k.id })}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <Button variant={app.disabled ? "default" : "destructive"} onClick={toggleDisabled}>
            {app.disabled ? "Enable app" : "Disable app"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
