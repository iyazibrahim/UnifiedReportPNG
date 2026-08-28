import { STATUS_BM } from "@/lib/api";
import { cn } from "@/lib/utils";

const FLOW = [
  "received",
  "acknowledged",
  "in_progress",
  "resolved",
] as const;

type HistoryItem = {
  status: string;
  note?: string;
  at?: string;
  actorUsername?: string;
};

type StatusTimelineProps = {
  currentStatus: string;
  createdAt?: string;
  history?: HistoryItem[];
};

function historyAt(history: HistoryItem[] | undefined, status: string) {
  const hit = [...(history || [])]
    .reverse()
    .find((h) => h.status === status);
  return hit?.at;
}

export function StatusTimeline({
  currentStatus,
  createdAt,
  history,
}: StatusTimelineProps) {
  const rejected = currentStatus === "rejected";
  const steps = rejected
    ? (["received", "acknowledged", "in_progress", "rejected"] as const)
    : FLOW;

  const currentIdx = steps.indexOf(
    currentStatus as (typeof steps)[number]
  );

  return (
    <ol className="relative space-y-0 border-l-2 border-[var(--color-border)] pl-4">
      {steps.map((step, i) => {
        const done =
          i < currentIdx ||
          step === currentStatus ||
          (step === "received" && currentIdx >= 0);
        const active = step === currentStatus;
        const at =
          step === "received"
            ? historyAt(history, "received") || createdAt
            : historyAt(history, step);

        return (
          <li key={step} className="relative pb-5 last:pb-0">
            <span
              className={cn(
                "absolute -left-[1.3rem] top-0.5 h-3 w-3 rounded-full border-2 bg-white",
                active && "border-[var(--agency,var(--color-primary))] bg-[var(--agency,var(--color-primary))]",
                done && !active && "border-emerald-600 bg-emerald-600",
                !done && !active && "border-[var(--color-border)]"
              )}
            />
            <p
              className={cn(
                "text-sm font-medium",
                !done && !active && "text-[var(--color-muted-foreground)]"
              )}
            >
              {STATUS_BM[step] || step}
            </p>
            {at ? (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {new Date(at).toLocaleString("ms-MY")}
              </p>
            ) : (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {done || active ? "—" : "Menunggu"}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
