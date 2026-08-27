import { Link } from "react-router-dom";
import { AGENCY_THEME } from "@/lib/api";
import { cn } from "@/lib/utils";

const PORTALS: Array<{
  id: keyof typeof AGENCY_THEME;
  blurb: string;
  span: string;
}> = [
  {
    id: "pearl_mbpp",
    blurb: "Majlis Bandaraya Pulau Pinang — kebersihan, longkang lokal, kemudahan awam",
    span: "sm:col-span-2 sm:row-span-2",
  },
  {
    id: "aspire_mbsp",
    blurb: "Majlis Bandaraya Seberang Perai — aduan PBT di Seberang",
    span: "sm:col-span-2 sm:row-span-2",
  },
  {
    id: "myjalan",
    blurb: "JKR / KKR — jalan persekutuan, lampu isyarat, infrastruktur jalan",
    span: "sm:col-span-2",
  },
  {
    id: "pbapp",
    blurb: "Bekalan air Pulau Pinang — paip bocor, gangguan air",
    span: "",
  },
  {
    id: "epintas",
    blurb: "PSUK triage — banjir, luar bidang, kes tidak pasti",
    span: "",
  },
];

export function MockPortalsHubPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mock portals</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          Pilih portal agensi untuk melihat inbox tiket simulasi. Ganti fail
          logo di <code className="text-xs">/agencies/*.svg</code> dengan aset
          rasmi bila tersedia.
        </p>
      </div>

      <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-4 sm:grid-cols-4">
        {PORTALS.map((p, i) => {
          const theme = AGENCY_THEME[p.id];
          return (
            <Link
              key={p.id}
              to={`/mock/${p.id}`}
              className={cn(
                "group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm transition duration-300",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                p.span
              )}
              style={{
                animation: `urp-bento-in 420ms ease both`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.08] transition group-hover:opacity-[0.14]"
                style={{
                  background: `radial-gradient(circle at 20% 20%, ${theme.accent}, transparent 55%)`,
                }}
              />
        <div className="relative flex items-start justify-between gap-3">
                <img
                  src={theme.logo}
                  alt={`${theme.short} logo`}
                  className={cn(
                    "rounded-xl shadow-sm ring-1 ring-black/5",
                    p.span.includes("row-span-2") ? "size-16" : "size-12"
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
                    p.span.includes("row-span-2") ? "text-xl" : "text-base"
                  )}
                >
                  {theme.label}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  {p.blurb}
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
