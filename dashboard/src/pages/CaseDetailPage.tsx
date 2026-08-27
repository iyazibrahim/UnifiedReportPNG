import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, AGENCY_THEME, STATUS_BM } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Detail = {
  case: {
    ref: string;
    status: string;
    intake?: { text?: string; photoFileIds?: string[] };
    location?: Record<string, unknown>;
    classification?: Record<string, unknown>;
    jurisdiction?: {
      agencyId?: string;
      agencyLabel?: string;
      reason?: string;
      needsTriage?: boolean;
    };
    dispatch?: { externalRef?: string; adapterId?: string };
    reporter?: { displayName?: string };
    createdAt?: string;
  };
  ticket: {
    externalRef: string;
    status: string;
    statusHistory?: Array<{ status: string; note?: string; at?: string }>;
  } | null;
};

export function CaseDetailPage() {
  const { ref } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ref) return;
    api<Detail>(`/api/admin/cases/${ref}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [ref]);

  if (error) return <p className="text-[var(--color-destructive)]">{error}</p>;
  if (!data) return <p>Loading…</p>;

  const c = data.case;
  const loc = (c.location || {}) as {
    lat?: number;
    lng?: number;
    display_name?: string;
    landmark?: string;
    confirmed?: boolean;
    source?: string;
    accuracy_m?: number;
  };
  const agencyId = c.jurisdiction?.agencyId || "";
  const portal =
    c.dispatch?.externalRef && agencyId
      ? `/mock/${agencyId}/${c.dispatch.externalRef}`
      : agencyId
        ? `/mock/${agencyId}`
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/cases" className="text-sm text-[var(--color-muted-foreground)]">
            ← Cases
          </Link>
          <h1 className="text-2xl font-semibold">{c.ref}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {c.jurisdiction?.reason}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{c.status}</Badge>
          {portal ? (
            <Button asChild={false} onClick={() => (window.location.href = portal)}>
              View in {AGENCY_THEME[agencyId]?.short || "portal"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Intake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{c.intake?.text || "—"}</p>
            <p className="text-[var(--color-muted-foreground)]">
              Reporter: {c.reporter?.displayName || "—"} · Photos:{" "}
              {c.intake?.photoFileIds?.length || 0}
            </p>
            <p>
              Category: {String(c.classification?.categoryLabel || "—")} (
              {String(c.classification?.method || "")})
            </p>
            <p>Agency: {c.jurisdiction?.agencyLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location (truth / confirm / label)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Truth: {loc.lat}, {loc.lng}
              {loc.accuracy_m != null ? ` (±${loc.accuracy_m}m)` : ""} · {loc.source}
            </p>
            <p>Confirmed: {loc.confirmed ? "yes" : "no"}</p>
            <p>Label: {loc.display_name || "—"}</p>
            <p>Landmark: {loc.landmark || "—"}</p>
            {loc.lat != null ? (
              <a
                className="underline"
                href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dispatch / mock ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>External ref: {c.dispatch?.externalRef || "—"}</p>
            {data.ticket ? (
              <>
                <p>
                  Portal status:{" "}
                  <Badge>
                    {STATUS_BM[data.ticket.status] || data.ticket.status}
                  </Badge>
                </p>
                <ul className="space-y-1">
                  {(data.ticket.statusHistory || []).map((h, i) => (
                    <li key={i} className="text-[var(--color-muted-foreground)]">
                      {STATUS_BM[h.status] || h.status} — {h.note}{" "}
                      {h.at ? `(${new Date(h.at).toLocaleString()})` : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[var(--color-muted-foreground)]">No mock ticket linked</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
