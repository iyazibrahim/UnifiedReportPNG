import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { LayoutGrid, Smartphone, LogOut } from "lucide-react";
import { AGENCY_THEME } from "@/lib/api";
import {
  clearAgencyToken,
  getAgencyLayout,
  setAgencyLayout,
  type AgencyLayout,
} from "@/lib/agencyAuth";
import { useState } from "react";

export function AgencyShell({ children }: { children: React.ReactNode }) {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const navigate = useNavigate();
  const [layout, setLayout] = useState<AgencyLayout>(getAgencyLayout());

  if (!theme) return <p className="p-6">Unknown agency</p>;

  function toggleLayout(next: AgencyLayout) {
    setAgencyLayout(next);
    setLayout(next);
  }

  function logout() {
    clearAgencyToken();
    navigate(`/portals/${agencyId}/login`);
  }

  const isDashboard = layout === "dashboard";

  return (
    <div
      className={cnShell(isDashboard)}
      style={{ ["--agency" as string]: theme.accent }}
    >
      <header
        className="sticky top-0 z-20 text-white shadow-sm"
        style={{ background: theme.accent }}
      >
        <div
          className={cnInner(
            isDashboard,
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          )}
        >
          <div className="flex items-center gap-3">
            <img
              src={theme.logo}
              alt=""
              className="h-9 w-9 rounded-lg bg-white/90 object-contain p-0.5"
            />
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">
                Portal agensi
              </p>
              <h1 className="text-lg font-semibold leading-tight">
                {theme.label}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleLayout("dashboard")}
              className={layoutBtn(isDashboard)}
              title="Dashboard"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => toggleLayout("app")}
              className={layoutBtn(!isDashboard)}
              title="Apps mode"
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Apps</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log keluar
            </button>
          </div>
        </div>
        {isDashboard ? (
          <nav className="flex gap-1 border-t border-white/20 px-4 py-2 text-sm">
            <Link
              to={`/portals/${agencyId}`}
              className="rounded-md px-3 py-1.5 hover:bg-white/10"
            >
              Ringkasan
            </Link>
            <Link
              to={`/portals/${agencyId}/inbox`}
              className="rounded-md px-3 py-1.5 hover:bg-white/10"
            >
              Peti masuk
            </Link>
            <Link
              to="/admin"
              className="ml-auto rounded-md px-3 py-1.5 text-white/80 hover:bg-white/10"
            >
              OnePenang Admin
            </Link>
          </nav>
        ) : null}
      </header>
      <main className={cnMain(isDashboard)}>{children}</main>
    </div>
  );
}

function layoutBtn(active: boolean) {
  return `flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
    active ? "bg-white text-[var(--agency)]" : "bg-white/15"
  }`;
}

function cnShell(dashboard: boolean) {
  return `min-h-screen bg-[var(--color-background)] ${
    dashboard ? "" : "mx-auto max-w-lg"
  }`;
}

function cnInner(dashboard: boolean, base: string) {
  return dashboard ? `${base} mx-auto max-w-6xl` : base;
}

function cnMain(dashboard: boolean) {
  return dashboard ? "mx-auto max-w-6xl p-4 md:p-6" : "p-4";
}

export function AgencyLayout() {
  return (
    <AgencyShell>
      <Outlet />
    </AgencyShell>
  );
}
