import { Activity, AlertTriangle, AppWindow, KeyRound, ScrollText, Users } from "lucide-react";

import { useStats } from "@/api/hooks";
import { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ?? "bg-primary/15 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useStats();

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your identity ecosystem" />
      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={Users} label="Users" value={data.users} />
            <StatCard icon={AppWindow} label="Apps" value={data.apps} />
            <StatCard icon={KeyRound} label="Active sessions" value={data.activeSessions} />
            <StatCard icon={ScrollText} label="Logs (24h)" value={data.logs24h} />
            <StatCard
              icon={AlertTriangle}
              label="Errors (24h)"
              value={data.errors24h}
              accent="bg-destructive/15 text-destructive"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Logs by app & level (24h)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.logsByLevel.length === 0 && (
                  <p className="text-sm text-muted-foreground">No logs in the last 24h.</p>
                )}
                {data.logsByLevel.map((row) => (
                  <div key={`${row.app}-${row.level}`} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.app}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.level === "error" || row.level === "fatal" ? "destructive" : row.level === "warn" ? "warning" : "secondary"}>
                        {row.level}
                      </Badge>
                      <span className="tabular-nums text-muted-foreground">{row.count}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" /> Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentAudit.length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
                {data.recentAudit.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{a.action}</span>{" "}
                      <span className="text-muted-foreground">by {a.actorEmail ?? "system"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
