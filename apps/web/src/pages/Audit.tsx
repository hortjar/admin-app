import { useAudit } from "@/api/hooks";
import { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export function AuditPage() {
  const { data, isLoading } = useAudit({ limit: 200 });

  return (
    <div>
      <PageHeader title="Audit log" description="Every privileged action taken in the admin console" />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                <TableCell className="text-sm">{a.actorEmail ?? "system"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{a.action}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.targetType ? `${a.targetType}:${a.targetId?.slice(0, 8)}` : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{a.ip ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
