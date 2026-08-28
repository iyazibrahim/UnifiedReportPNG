import { Link } from "react-router-dom";
import { AGENCY_THEME } from "@/lib/api";
import { cn } from "@/lib/utils";

const PORTAL_ORDER = [
  "pearl_mbpp",
  "aspire_mbsp",
  "myjalan",
  "pbapp",
  "epintas",
] as const;

const SPANS: Record<string, string> = {
  pearl_mbpp: "sm:col-span-2 sm:row-span-2",
  aspire_mbsp: "sm:col-span-2 sm:row-span-2",
  myjalan: "sm:col-span-2",
  pbapp: "",
  epintas: "",
};

export function MockPortalsHubPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agency portals</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          Pilih portal agensi untuk melihat inbox tiket.
        </p>
      </div>

      <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-4 sm:grid-cols-4">
        {PORTAL_ORDER.map((id, i) => {
          const theme = AGENCY_THEME[id];
          const span = SPANS[id] || "";
          return (
            <Link
              key={id}
              to={`/portals/${id}`}
              className={cn(
                "group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-300",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                span
              )}
              style={{
                animation: `urp-bento-in 420ms ease both`,
                animationDelay: `${i * 60}ms`,
                background: `linear-gradient(135deg, ${theme.gradientFrom} 0%, ${theme.gradientTo} 70%)`,
                borderColor: `${theme.accent}22`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-1"
                style={{ background: theme.accent, opacity: 0.35 }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <img
                  src={theme.logo}
                  alt={`${theme.short} logo`}
                  className={cn(
                    "object-contain bg-white p-1 shadow-sm ring-1 ring-black/5",
                    span.includes("row-span-2")
                      ? "size-16 rounded-xl"
                      : "size-12 rounded-lg"
                  )}
                />
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                  style={{ background: theme.accent }}
                >
                  Open
                </span>
              </div>
              <div className="relative mt-4">
                <h2
                  className={cn(
                    "font-semibold tracking-tight",
                    span.includes("row-span-2") ? "text-xl" : "text-base"
                  )}
                >
                  {theme.label}
                </h2>
                <p className="mt-1 text-sm font-medium text-[var(--color-foreground)]/80">
                  {theme.mission}
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  {theme.blurb}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <style>{`
        @keyframes urp-bento-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
