import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, getToken, AGENCY_THEME, STATUS_BM } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselDots,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

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

function osmEmbedUrl(lat: number, lng: number, delta = 0.008) {
  const bbox = [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
  ].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function photoUrl(ref: string, fileId: string) {
  const token = getToken() || "";
  return `/api/admin/cases/${encodeURIComponent(ref)}/photos/${encodeURIComponent(fileId)}?access_token=${encodeURIComponent(token)}`;
}

export function CaseDetailPage() {
  const { ref } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) return;
    api<Detail>(`/api/admin/cases/${ref}`)
      .then(setData)
      .catch((e) => {
        setError(e.message);
        toast.error(e.message);
      });
  }, [ref]);

  const photoIds = useMemo(
    () => data?.case.intake?.photoFileIds || [],
    [data]
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Case not available</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const c = data.case;
  const loc = (c.location || {}) as {
    lat?: number;
    lng?: number;
    display_name?: string;
    landmark?: string;
    placeName?: string;
    daerahLabel?: string;
    daerah?: string;
    confirmed?: boolean;
    method?: string;
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
        <div className="space-y-2">
          <Link
            to="/admin/cases"
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs font-medium hover:bg-[var(--color-accent)]"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Cases
          </Link>
          <h1 className="text-2xl font-semibold">{c.ref}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {c.jurisdiction?.reason}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{c.status}</Badge>
          {portal ? (
            <Button onClick={() => (window.location.href = portal)}>
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
          <CardContent className="space-y-3 text-sm">
            <p>{c.intake?.text || "—"}</p>
            <p className="text-[var(--color-muted-foreground)]">
              Reporter: {c.reporter?.displayName || "—"}
            </p>
            <p>
              Category: {String(c.classification?.categoryLabel || "—")} (
              {String(c.classification?.method || "")})
            </p>
            <p>Agency: {c.jurisdiction?.agencyLabel}</p>
            {photoIds.length > 0 ? (
              <div>
                <p className="mb-2 font-medium">Photos ({photoIds.length})</p>
                <Carousel className="w-full max-w-md">
                  <CarouselContent>
                    {photoIds.map((id, i) => {
                      const src = photoUrl(c.ref, id);
                      return (
                        <CarouselItem key={id}>
                          <button
                            type="button"
                            className="block w-full overflow-hidden rounded-md border border-[var(--color-border)]"
                            onClick={() => setLightbox(src)}
                          >
                            <img
                              src={src}
                              alt={`Evidence photo ${i + 1} of ${photoIds.length}`}
                              className="aspect-video w-full object-cover"
                            />
                          </button>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                  {photoIds.length > 1 ? (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  ) : null}
                  <CarouselDots />
                </Carousel>
              </div>
            ) : (
              <p className="text-[var(--color-muted-foreground)]">No photos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lokasi laporan</CardTitle>
            <p className="text-xs font-normal text-[var(--color-muted-foreground)]">
              Pin GPS digunakan untuk penyaluran agensi; nama jalan hanya
              rujukan (mungkin jalan besar berdekatan).
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Pin GPS</p>
              <p>
                {loc.lat != null && loc.lng != null
                  ? `${loc.lat}, ${loc.lng}`
                  : "—"}
                {loc.accuracy_m != null ? ` (±${loc.accuracy_m}m)` : ""}
                {loc.source ? ` · ${loc.source}` : ""}
              </p>
            </div>
            <div>
              <p className="font-medium">Disahkan oleh pelapor</p>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-1">
                Pelapor tekan Ya pada pin sebelum hantar
              </p>
              <p>
                {loc.confirmed ? "Ya" : "Tidak"}
                {loc.method ? ` · ${loc.method}` : ""}
              </p>
            </div>
            <div>
              <p className="font-medium">Nama lokasi laporan</p>
              <p>{loc.display_name || "—"}</p>
              {loc.placeName ? (
                <p className="text-[var(--color-muted-foreground)]">
                  Mercu tanda DB: {loc.placeName}
                </p>
              ) : null}
              {loc.daerahLabel || loc.daerah ? (
                <p className="text-[var(--color-muted-foreground)]">
                  Daerah: {loc.daerahLabel || loc.daerah}
                </p>
              ) : null}
              {loc.landmark ? (
                <p className="text-[var(--color-muted-foreground)]">
                  Teks pelapor: {loc.landmark}
                </p>
              ) : null}
            </div>
            {loc.lat != null && loc.lng != null ? (
              <>
                <iframe
                  title="OSM map"
                  className="h-[220px] w-full rounded-md border border-[var(--color-border)]"
                  src={osmEmbedUrl(Number(loc.lat), Number(loc.lng))}
                />
                <a
                  className="inline-block underline"
                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dispatch / agency ticket</CardTitle>
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
                    <li
                      key={i}
                      className="text-[var(--color-muted-foreground)]"
                    >
                      {STATUS_BM[h.status] || h.status} — {h.note}{" "}
                      {h.at ? `(${new Date(h.at).toLocaleString()})` : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[var(--color-muted-foreground)]">
                No agency ticket linked
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => e.key === "Escape" && setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
