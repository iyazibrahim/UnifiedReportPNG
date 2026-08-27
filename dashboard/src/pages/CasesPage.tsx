import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, AGENCY_THEME } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";

type Stats = {
  total: number;
  byStatus: Record<string, number>;
  byAgency: Record<string, number>;
  recent: Array<{
    ref: string;
    status: string;
    classification?: { categoryLabel?: string };
    jurisdiction?: { agencyId?: string; agencyLabel?: string; reason?: string };
    createdAt?: string;
  }>;
};

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Stats>("/api/admin/stats")
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-[var(--color-destructive)]">{error}</p>;
  if (!stats) return <p className="text-[var(--color-muted-foreground)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Monitor unified intake and agency routing
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
              Total cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>
        {Object.entries(stats.byAgency).map(([id, count]) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
                {AGENCY_THEME[id]?.short || id}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.recent.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No cases yet. Submit via Telegram bot.
            </p>
          ) : (
            stats.recent.map((c) => (
              <Link
                key={c.ref}
                to={`/admin/cases/${c.ref}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-accent)]"
              >
                <div>
                  <div className="font-medium">{c.ref}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {c.classification?.categoryLabel} · {c.jurisdiction?.agencyLabel}
                  </div>
                </div>
                <Badge>{c.status}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
