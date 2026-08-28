import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, AGENCY_THEME } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DonutChart } from "@/components/charts/DonutChart";
import { AgencyFlow } from "@/components/charts/AgencyFlow";
import { StatCard } from "@/components/StatCard";

type Stats = {
  total: number;
  byStatus: Record<string, number>;
  byAgency: Record<string, number>;
  byCategory: Record<string, number>;
  byTicketStatus: { open: number; in_progress: number; closed: number };
  kpis?: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
  vsLastMonth?: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
  recent: Array<{
    ref: string;
    status: string;
    classification?: { categoryLabel?: string };
    jurisdiction?: { agencyId?: string; agencyLabel?: string; reason?: string };
    createdAt?: string;
  }>;
};

const STATUS_COLORS = {
  open: "oklch(0.52 0.14 235)",
  in_progress: "oklch(0.72 0.14 85)",
  closed: "oklch(0.42 0.1 155)",
};

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function load() {
      api<Stats>("/api/admin/stats")
        .then(setStats)
        .catch((e) => {
          setError(e.message);
          toast.error(e.message);
        });
    }
    load();
    function onCreated() {
      load();
    }
    window.addEventListener("urp:case_created", onCreated);
    return () => window.removeEventListener("urp:case_created", onCreated);
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Overview unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!stats) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const ticket = stats.byTicketStatus || {
    open: 0,
    in_progress: 0,
    closed: 0,
  };
  const kpis = stats.kpis || {
    total: stats.total,
    open: ticket.open,
    in_progress: ticket.in_progress,
    closed: ticket.closed,
  };
  const prev = stats.vsLastMonth || {
    total: 0,
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Monitor unified intake and agency routing · this month vs last month
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total" value={kpis.total} previous={prev.total} />
        <StatCard title="Open" value={kpis.open} previous={prev.open} />
        <StatCard
          title="In progress"
          value={kpis.in_progress}
          previous={prev.in_progress}
        />
        <StatCard title="Closed" value={kpis.closed} previous={prev.closed} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agency routing flow</CardTitle>
            <p className="text-xs font-normal text-[var(--color-muted-foreground)]">
              Citizen reports distributed to agency portals
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full">
              <AgencyFlow byAgency={stats.byAgency || {}} />
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-muted-foreground)]">
                {Object.entries(stats.byAgency || {}).map(([id, count]) => (
                  <span key={id}>
                    {AGENCY_THEME[id]?.short || id}: {count}
                  </span>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent cases</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full pr-3">
              <div className="flex flex-col gap-3">
                {stats.recent.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    No cases yet. Submit via Telegram bot.
                  </p>
                ) : (
                  stats.recent.map((c) => (
                    <Link
                      key={c.ref}
                      to={`/admin/cases/${c.ref}`}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-accent)]"
                    >
                      <div>
                        <div className="font-medium">{c.ref}</div>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          {c.classification?.categoryLabel} ·{" "}
                          {c.jurisdiction?.agencyLabel}
                        </div>
                      </div>
                      <Badge variant="secondary">{c.status}</Badge>
                    </Link>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
