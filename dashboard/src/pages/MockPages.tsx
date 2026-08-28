import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AGENCY_THEME, STATUS_BM } from "@/lib/api";
import {
  agencyApi,
  getAgencyLayout,
  getAgencyToken,
} from "@/lib/agencyAuth";
import { AgencyShell } from "@/components/agency/AgencyShell";
import { ReportMap } from "@/components/agency/ReportMap";
import { StatusTimeline } from "@/components/agency/StatusTimeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Ticket = {
  _id?: string;
  externalRef: string;
  caseRef?: string;
  status: string;
  createdAt?: string;
  dueAt?: string;
  sla?: { dueAt?: string; overdue?: boolean };
  payload?: {
    intake?: { text?: string; photoFileIds?: string[] };
    location?: {
      lat?: number;
      lng?: number;
      display_name?: string;
      landmark?: string;
      daerahLabel?: string;
    };
    classification?: { categoryLabel?: string };
    jurisdiction?: { reason?: string };
  };
  statusHistory?: Array<{
    status: string;
    note?: string;
    at?: string;
    actorUsername?: string;
  }>;
};

function RequireAgencyAuth({ children }: { children: React.ReactNode }) {
  const { agencyId = "" } = useParams();
  if (!getAgencyToken()) {
    return <Navigate to={`/portals/${agencyId}/login`} replace />;
  }
  return children;
}

function agencyPhotoUrl(
  agencyId: string,
  externalRef: string,
  fileId: string
) {
  const token = getAgencyToken() || "";
  return `/api/agencies/${agencyId}/tickets/${encodeURIComponent(externalRef)}/photos/${encodeURIComponent(fileId)}?access_token=${encodeURIComponent(token)}`;
}

const NEXT_ACTIONS: Record<string, Array<{ id: string; label: string }>> = {
  received: [
    { id: "acknowledged", label: "Diakui" },
    { id: "in_progress", label: "Dalam tindakan" },
    { id: "rejected", label: "Ditolak" },
  ],
  acknowledged: [
    { id: "in_progress", label: "Dalam tindakan" },
    { id: "rejected", label: "Ditolak" },
  ],
  in_progress: [
    { id: "resolved", label: "Selesai" },
    { id: "rejected", label: "Ditolak" },
  ],
};

function TicketCard({
  ticket,
  agencyId,
  onClick,
}: {
  ticket: Ticket;
  agencyId: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="w-full text-left" onClick={onClick}>
      <Card className="hover:bg-[var(--color-accent)]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{ticket.externalRef}</CardTitle>
            <div className="flex gap-1">
              {ticket.sla?.overdue ? (
                <Badge variant="destructive">Lewat SLA</Badge>
              ) : null}
              <Badge>{STATUS_BM[ticket.status] || ticket.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="line-clamp-2">
            {ticket.payload?.intake?.text || ticket.caseRef}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {ticket.payload?.classification?.categoryLabel} ·{" "}
            {ticket.payload?.location?.display_name || "tiada lokasi"}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

export function AgencyOverviewPage() {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const layout = getAgencyLayout();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    counts: Record<string, number>;
    overdue: number;
  } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!theme) return;
    Promise.all([
      agencyApi<{ counts: Record<string, number>; overdue: number }>(
        `/api/agencies/${agencyId}/stats`
      ),
      agencyApi<{ items: Ticket[] }>(
        `/api/agencies/${agencyId}/tickets?status=received`
      ),
    ])
      .then(([s, t]) => {
        setStats(s);
        setTickets(t.items.slice(0, 5));
      })
      .catch((e) => setError(e.message));
  }, [agencyId, theme]);

  if (layout === "app") {
    return <Navigate to={`/portals/${agencyId}/inbox`} replace />;
  }

  if (!theme) return <p>Unknown agency</p>;

  const c = stats?.counts || {};

  return (
    <RequireAgencyAuth>
      <AgencyShell>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["received", "Baharu"],
            ["acknowledged", "Diakui"],
            ["in_progress", "Dalam tindakan"],
            ["resolved", "Selesai"],
            ["rejected", "Ditolak"],
          ].map(([k, label]) => (
            <Card key={k}>
              <CardContent className="p-4">
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {label}
                </p>
                <p className="text-2xl font-semibold">{c[k] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {stats?.overdue ? (
          <Alert className="mb-4">
            <AlertDescription>
              {stats.overdue} aduan melepasi SLA — semak peti masuk.
            </AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Aduan baharu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Tiada aduan baharu.
              </p>
            ) : (
              tickets.map((t) => (
                <TicketCard
                  key={t.externalRef}
                  ticket={t}
                  agencyId={agencyId}
                  onClick={() =>
                    navigate(`/portals/${agencyId}/${t.externalRef}`)
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </AgencyShell>
    </RequireAgencyAuth>
  );
}

export function MockInboxPage() {
  return <AgencyInboxPage />;
}

export function AgencyInboxPage() {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const layout = getAgencyLayout();
  const navigate = useNavigate();
  const [items, setItems] = useState<Ticket[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!theme) return;
    agencyApi<{ items: Ticket[] }>(`/api/agencies/${agencyId}/tickets`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [agencyId, theme]);

  if (!theme) return <p className="p-6">Unknown agency</p>;

  const content =
    layout === "dashboard" ? (
      <Card>
        <CardHeader>
          <CardTitle>Peti masuk</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rujukan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Tarikh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow
                  key={t.externalRef}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate(`/portals/${agencyId}/${t.externalRef}`)
                  }
                >
                  <TableCell className="font-medium">{t.externalRef}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {t.sla?.overdue ? (
                        <Badge variant="destructive">SLA</Badge>
                      ) : null}
                      <Badge>{STATUS_BM[t.status] || t.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.payload?.classification?.categoryLabel || "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {t.payload?.location?.display_name || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString("ms-MY")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-3">
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-[var(--color-muted-foreground)]">
              Tiada tiket lagi.
            </CardContent>
          </Card>
        ) : (
          items.map((t) => (
            <TicketCard
              key={t.externalRef}
              ticket={t}
              agencyId={agencyId}
              onClick={() =>
                navigate(`/portals/${agencyId}/${t.externalRef}`)
              }
            />
          ))
        )}
      </div>
    );

  return (
    <RequireAgencyAuth>
      <AgencyShell>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {content}
      </AgencyShell>
    </RequireAgencyAuth>
  );
}

export function MockTicketPage() {
  return <AgencyTicketPage />;
}

export function AgencyTicketPage() {
  const { agencyId = "", externalRef = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const layout = getAgencyLayout();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [caseRef, setCaseRef] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    const res = await agencyApi<{
      ticket: Ticket;
      case?: { ref?: string };
    }>(`/api/agencies/${agencyId}/tickets/${externalRef}`);
    setTicket(res.ticket);
    setCaseRef(res.case?.ref || res.ticket.caseRef || null);
  }

  useEffect(() => {
    if (!theme) return;
    load().catch((e) => setError(e.message));
  }, [agencyId, externalRef, theme]);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await agencyApi<{ ticket: Ticket }>(
        `/api/agencies/${agencyId}/tickets/${externalRef}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, note: note || undefined }),
        }
      );
      setTicket(res.ticket);
      setNote("");
      toast.success(`Status: ${STATUS_BM[status] || status}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!theme) return <p className="p-6">Unknown agency</p>;
  if (!ticket && !error) return <p className="p-6">Loading…</p>;

  const loc = ticket?.payload?.location;
  const photos = ticket?.payload?.intake?.photoFileIds || [];
  const actions = ticket ? NEXT_ACTIONS[ticket.status] || [] : [];

  const infoBlock = ticket ? (
    <Card>
      <CardHeader>
        <CardTitle>Maklumat aduan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{ticket.payload?.intake?.text}</p>
        <p className="text-[var(--color-muted-foreground)]">
          {ticket.payload?.classification?.categoryLabel}
        </p>
        <p className="text-xs">{ticket.payload?.jurisdiction?.reason}</p>
        <div className="space-y-1">
          <p>
            <span className="font-medium">Lokasi:</span>{" "}
            {loc?.display_name || "—"}
          </p>
          {loc?.landmark ? <p>Teks pelapor: {loc.landmark}</p> : null}
          {loc?.daerahLabel ? <p>Daerah: {loc.daerahLabel}</p> : null}
          {loc?.lat != null ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {loc.lat}, {loc.lng}
            </p>
          ) : null}
        </div>
        {loc?.lat != null && loc.lng != null ? (
          <ReportMap lat={Number(loc.lat)} lng={Number(loc.lng)} />
        ) : null}
        {photos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {photos.map((id) => (
              <a
                key={id}
                href={agencyPhotoUrl(agencyId, ticket.externalRef, id)}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={agencyPhotoUrl(agencyId, ticket.externalRef, id)}
                  alt="Bukti"
                  className="h-20 w-20 rounded-md border object-cover"
                />
              </a>
            ))}
          </div>
        ) : null}
        <p className="text-xs">
          Rujukan OnePenang:{" "}
          {caseRef ? (
            <Link className="underline" to={`/admin/cases/${caseRef}`}>
              {caseRef}
            </Link>
          ) : (
            "—"
          )}
        </p>
        {ticket.dueAt ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            SLA: {new Date(ticket.dueAt).toLocaleString("ms-MY")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  ) : null;

  const workflowBlock = ticket ? (
    <Card>
      <CardHeader>
        <CardTitle>Status & tindakan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge className="text-sm">
          {STATUS_BM[ticket.status] || ticket.status}
        </Badge>
        <StatusTimeline
          currentStatus={ticket.status}
          createdAt={ticket.createdAt}
          history={ticket.statusHistory}
        />
        {actions.length > 0 ? (
          <>
            <Input
              placeholder="Catatan (pilihan)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {actions.map(({ id, label }) => (
                <Button
                  key={id}
                  size="sm"
                  variant={ticket.status === id ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => setStatus(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Aduan ditutup.
          </p>
        )}
      </CardContent>
    </Card>
  ) : null;

  return (
    <RequireAgencyAuth>
      <AgencyShell>
        <div className="mb-3">
          <Link
            to={`/portals/${agencyId}/inbox`}
            className="text-sm underline"
          >
            ← Kembali ke peti masuk
          </Link>
        </div>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {layout === "dashboard" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {infoBlock}
            {workflowBlock}
          </div>
        ) : (
          <div className="space-y-4">
            {infoBlock}
            {workflowBlock}
          </div>
        )}
      </AgencyShell>
    </RequireAgencyAuth>
  );
}
