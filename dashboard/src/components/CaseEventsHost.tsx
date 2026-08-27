import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

export type CaseCreatedEvent = {
  ref: string;
  agencyLabel?: string | null;
  categoryLabel?: string | null;
  createdAt?: string;
};

type ToastItem = CaseCreatedEvent & { id: string };

const DISMISS_MS = 10_000;

export function CaseEventsHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = `/api/admin/events?access_token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener("case_created", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as CaseCreatedEvent;
        if (!data?.ref) return;
        const id = `${data.ref}-${Date.now()}`;
        setToasts((prev) => [...prev, { ...data, id }]);
        window.dispatchEvent(
          new CustomEvent("urp:case_created", { detail: data })
        );
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, DISMISS_MS);
      } catch {
        /* ignore bad payloads */
      }
    });

    es.onerror = () => {
      /* browser will retry EventSource */
    };

    return () => es.close();
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg"
          role="status"
        >
          <p className="text-sm font-medium">Laporan baharu: {t.ref}</p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {[t.categoryLabel, t.agencyLabel].filter(Boolean).join(" · ") ||
              "Aduan diterima"}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => navigate(`/admin/cases/${t.ref}`)}
            >
              Lihat laporan
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              Tutup
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
