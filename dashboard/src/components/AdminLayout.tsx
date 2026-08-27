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

const links = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/cases", label: "Cases", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
        <div className="p-5">
          <div className="text-xs uppercase tracking-[0.14em] opacity-70">
            Unified Report
          </div>
          <div className="mt-1 text-lg font-semibold">Penang Admin</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap",
                  isActive ? "bg-white/15" : "hover:bg-white/10"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <a
            href="/mock/pearl_mbpp"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" />
            Mock portals
          </a>
        </nav>
        <div className="hidden md:block p-3 mt-auto">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              clearToken();
              navigate("/admin/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>
      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
