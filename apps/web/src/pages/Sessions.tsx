import { toast } from "sonner";

import { useRevokeSession, useSessions } from "@/api/hooks";
import { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export function SessionsPage() {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();

  return (
    <div>
      <PageHeader title="Sessions" description="Active refresh-token sessions across all apps" />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>User agent</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
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
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No active sessions.
                </TableCell>
              </TableRow>
            )}
            {data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Badge variant={s.app ? "secondary" : "default"}>{s.app ?? "admin"}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{s.ip ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{s.userAgent ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(s.expiresAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await revoke.mutateAsync(s.id);
                      toast.success("Session revoked");
                    }}
                  >
                    Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
