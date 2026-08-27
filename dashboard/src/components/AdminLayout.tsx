import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CaseEventsHost } from "@/components/CaseEventsHost";

const links = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/cases", label: "Cases", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/portals", label: "Agency portals", icon: ExternalLink },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const logout = () => {
    clearToken();
    navigate("/admin/login");
  };

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden md:grid md:grid-cols-[240px_1fr]">
        <aside className="flex shrink-0 flex-col overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] md:h-full md:border-b-0 md:border-r">
          <div className="flex items-start justify-between gap-3 p-5">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] opacity-70">
                Unified Report
              </div>
              <div className="mt-1 text-lg font-semibold">Penang Admin</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 md:hidden"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap",
                    isActive ? "bg-white/15" : "hover:bg-white/10"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto hidden shrink-0 p-3 md:block">
            <Button variant="secondary" className="w-full" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </aside>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      <CaseEventsHost />
    </>
  );
}
