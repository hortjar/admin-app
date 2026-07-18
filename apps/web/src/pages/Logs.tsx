import { useState } from "react";

import { useApps, useLogs } from "@/api/hooks";
import type { LogDto, LogLevel } from "@/api/types";
import { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

function levelVariant(level: LogLevel) {
  if (level === "error" || level === "fatal") return "destructive" as const;
  if (level === "warn") return "warning" as const;
  if (level === "debug" || level === "trace") return "outline" as const;
  return "secondary" as const;
}

export function LogsPage() {
  const { data: apps } = useApps();
  const [app, setApp] = useState("");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<LogDto | null>(null);

  const { data, isLoading } = useLogs({ app, level, search, limit: 200 });

  return (
    <div>
      <PageHeader title="Logs" description="Structured logs collected from all your apps" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={app} onChange={(e) => setApp(e.target.value)}>
          <option value="">All apps</option>
          {apps?.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.name}
            </option>
          ))}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <Input className="w-64" placeholder="Search message…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {data && <span className="text-sm text-muted-foreground">{data.total} entries</span>}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Time</TableHead>
              <TableHead className="w-24">Level</TableHead>
              <TableHead className="w-32">App</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No logs match your filters.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((log) => (
              <TableRow key={log.id} className="cursor-pointer" onClick={() => setExpanded(expanded?.id === log.id ? null : log)}>
                <TableCell className="font-mono text-xs text-muted-foreground">{formatDate(log.timestamp)}</TableCell>
                <TableCell>
                  <Badge variant={levelVariant(log.level)}>{log.level}</Badge>
                </TableCell>
                <TableCell className="text-sm">{log.app}</TableCell>
                <TableCell className="text-sm">
                  <div className="truncate">{log.message}</div>
                  {expanded?.id === log.id && log.context && (
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(log.context, null, 2)}
                    </pre>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
