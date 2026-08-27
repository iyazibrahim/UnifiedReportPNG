import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, AGENCY_THEME } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { DonutChart } from "@/components/charts/DonutChart";
import { AgencyFlow } from "@/components/charts/AgencyFlow";

type Stats = {
  total: number;
  byStatus: Record<string, number>;
  byAgency: Record<string, number>;
  byCategory: Record<string, number>;
  byTicketStatus: { open: number; in_progress: number; closed: number };
  recent: Array<{
    ref: string;
    status: string;
    classification?: { categoryLabel?: string };
    jurisdiction?: { agencyId?: string; agencyLabel?: string; reason?: string };
    createdAt?: string;
  }>;
};

const STATUS_COLORS = {
  open: "#40916c",
  in_progress: "#d4a017",
  closed: "#1c4b3a",
};

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function load() {
      api<Stats>("/api/admin/stats")
        .then(setStats)
        .catch((e) => setError(e.message));
    }
    load();
    function onCreated() {
      load();
    }
    window.addEventListener("urp:case_created", onCreated);
    return () => window.removeEventListener("urp:case_created", onCreated);
  }, []);

  if (error) return <p className="text-[var(--color-destructive)]">{error}</p>;
  if (!stats)
    return <p className="text-[var(--color-muted-foreground)]">Loading…</p>;

  const ticket = stats.byTicketStatus || {
    open: 0,
    in_progress: 0,
    closed: 0,
  };

  const categorySlices = Object.entries(stats.byCategory || {}).map(
    ([label, value]) => ({ label, value })
  );
  const statusSlices = [
    { label: "Open", value: ticket.open, color: STATUS_COLORS.open },
    {
      label: "In progress",
      value: ticket.in_progress,
      color: STATUS_COLORS.in_progress,
    },
    { label: "Closed", value: ticket.closed, color: STATUS_COLORS.closed },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Monitor unified intake and agency routing
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Total", stats.total],
            ["Open", ticket.open],
            ["In progress", ticket.in_progress],
            ["Closed", ticket.closed],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent>
            {categorySlices.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No classified cases yet.
              </p>
            ) : (
              <DonutChart slices={categorySlices} title="By category" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart slices={statusSlices} title="By status" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agency routing flow</CardTitle>
          <p className="text-xs font-normal text-[var(--color-muted-foreground)]">
            Citizen reports distributed to agency mock portals
          </p>
        </CardHeader>
        <CardContent>
          <AgencyFlow byAgency={stats.byAgency || {}} />
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
            {Object.entries(stats.byAgency || {}).map(([id, count]) => (
              <span key={id}>
                {AGENCY_THEME[id]?.short || id}: {count}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

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
                    {c.classification?.categoryLabel} ·{" "}
                    {c.jurisdiction?.agencyLabel}
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
