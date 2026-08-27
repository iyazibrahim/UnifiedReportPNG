import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, AGENCY_THEME, STATUS_BM } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Ticket = {
  externalRef: string;
  caseRef?: string;
  status: string;
  createdAt?: string;
  payload?: {
    intake?: { text?: string };
    location?: { lat?: number; lng?: number; display_name?: string; landmark?: string };
    classification?: { categoryLabel?: string };
    jurisdiction?: { reason?: string };
  };
  statusHistory?: Array<{ status: string; note?: string; at?: string }>;
};

export function MockInboxPage() {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const [items, setItems] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!theme) return;
    api<{ items: Ticket[] }>(`/api/mock/${agencyId}/tickets`, { auth: false })
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [agencyId, theme]);

  if (!theme) {
    return <p className="p-6">Unknown agency</p>;
  }

  return (
    <div
      className="min-h-screen mx-auto max-w-lg"
      style={{ ["--agency" as string]: theme.accent }}
    >
      <header
        className="sticky top-0 z-10 px-4 py-4 text-white"
        style={{ background: theme.accent }}
      >
        <div className="text-xs uppercase tracking-widest opacity-80">
          Mock agency portal
        </div>
        <h1 className="text-xl font-semibold">{theme.label}</h1>
        <p className="text-sm opacity-90">
          Tickets routed from Unified Report Penang
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(AGENCY_THEME).map((id) => (
            <Link
              key={id}
              to={`/mock/${id}`}
              className="rounded-full bg-white/15 px-2 py-0.5 text-xs"
            >
              {AGENCY_THEME[id].short}
            </Link>
          ))}
        </div>
      </header>

      <main className="space-y-3 p-4">
        {error ? <p className="text-red-700 text-sm">{error}</p> : null}
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-[var(--color-muted-foreground)]">
              Tiada tiket lagi. Hantar aduan melalui Telegram bot.
            </CardContent>
          </Card>
        ) : (
          items.map((t) => (
            <button
              key={t.externalRef}
              type="button"
              className="w-full text-left"
              onClick={() => navigate(`/mock/${agencyId}/${t.externalRef}`)}
            >
              <Card className="hover:bg-[var(--color-accent)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{t.externalRef}</CardTitle>
                    <Badge>{STATUS_BM[t.status] || t.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="line-clamp-2">
                    {t.payload?.intake?.text || t.caseRef}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {t.payload?.classification?.categoryLabel} ·{" "}
                    {t.payload?.location?.display_name || "no label"}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))
        )}
      </main>
    </div>
  );
}

export function MockTicketPage() {
  const { agencyId = "", externalRef = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api<{ ticket: Ticket }>(
      `/api/mock/${agencyId}/tickets/${externalRef}`,
      { auth: false }
    );
    setTicket(res.ticket);
  }

  useEffect(() => {
    if (!theme) return;
    load().catch((e) => setError(e.message));
  }, [agencyId, externalRef, theme]);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      const res = await api<{ ticket: Ticket }>(
        `/api/mock/${agencyId}/tickets/${externalRef}/status`,
        {
          method: "PATCH",
          auth: false,
          body: JSON.stringify({ status }),
        }
      );
      setTicket(res.ticket);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!theme) return <p className="p-6">Unknown agency</p>;
  if (!ticket && !error) return <p className="p-6">Loading…</p>;

  const loc = ticket?.payload?.location;

  return (
    <div className="min-h-screen mx-auto max-w-lg">
      <header className="px-4 py-4 text-white" style={{ background: theme.accent }}>
        <Link to={`/mock/${agencyId}`} className="text-sm opacity-90">
          ← Inbox
        </Link>
        <h1 className="text-xl font-semibold">{ticket?.externalRef}</h1>
        <p className="text-sm opacity-90">{theme.label}</p>
      </header>
      <main className="space-y-4 p-4">
        {error ? <p className="text-red-700 text-sm">{error}</p> : null}
        {ticket ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Aduan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{ticket.payload?.intake?.text}</p>
                <p className="text-[var(--color-muted-foreground)]">
                  {ticket.payload?.classification?.categoryLabel}
                </p>
                <p className="text-xs">{ticket.payload?.jurisdiction?.reason}</p>
                <p>
                  Lokasi: {loc?.display_name || "—"}
                  {loc?.landmark ? ` · ${loc.landmark}` : ""}
                </p>
                {loc?.lat != null ? (
                  <a
                    className="underline"
                    href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka peta
                  </a>
                ) : null}
                <p>
                  Case ref:{" "}
                  <Link className="underline" to={`/admin/cases/${ticket.caseRef}`}>
                    {ticket.caseRef}
                  </Link>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge>{STATUS_BM[ticket.status] || ticket.status}</Badge>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["received", "Diterima"],
                      ["in_progress", "Dalam tindakan"],
                      ["resolved", "Selesai"],
                      ["rejected", "Ditolak"],
                    ] as const
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      size="sm"
                      variant={ticket.status === id ? "default" : "outline"}
                      disabled={busy || ticket.status === id}
                      onClick={() => setStatus(id)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <ul className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
                  {(ticket.statusHistory || []).map((h, i) => (
                    <li key={i}>
                      {STATUS_BM[h.status] || h.status} — {h.note}{" "}
                      {h.at ? `(${new Date(h.at).toLocaleString()})` : ""}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
