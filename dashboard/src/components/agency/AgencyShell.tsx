import { Link, useNavigate, useParams } from "react-router-dom";
import { LogOut, User, ChevronDown } from "lucide-react";
import { AGENCY_THEME } from "@/lib/api";
import {
  clearAgencyToken,
  getSessionClaims,
  hasAdminSession,
  isAdminClaims,
} from "@/lib/agencyAuth";
import { useState } from "react";
import { AgencyPasswordModal } from "./AgencyPasswordModal";

export function AgencyShell({ children }: { children: React.ReactNode }) {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!theme) return <p className="p-6">Unknown agency</p>;

  const claims = getSessionClaims(agencyId);
  const username = claims?.sub || "Pengguna";
  const showAdminLink = isAdminClaims(claims) || hasAdminSession();

  function logout() {
    clearAgencyToken(agencyId);
    navigate(`/portals/${agencyId}/login`);
  }

  return (
    <div
      className="min-h-screen bg-[var(--color-background)]"
      style={{ ["--agency" as string]: theme.accent }}
    >
      <header
        className="sticky top-0 z-20 text-white shadow-sm"
        style={{ background: theme.accent }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
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
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium"
            >
              <User className="h-3.5 w-3.5" />
              <span className="max-w-[120px] truncate">{username}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 text-sm text-[var(--color-foreground)] shadow-lg">
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left hover:bg-[var(--color-accent)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordOpen(true);
                  }}
                >
                  Tukar kata laluan
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[var(--color-accent)]"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log keluar
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <nav className="flex gap-1 border-t border-white/20 px-4 py-2 text-sm">
          <div className="mx-auto flex w-full max-w-6xl gap-1">
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
            {showAdminLink ? (
              <Link
                to="/admin"
                className="ml-auto rounded-md px-3 py-1.5 text-white/80 hover:bg-white/10"
              >
                OnePenang Admin
              </Link>
            ) : null}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
      <AgencyPasswordModal
        agencyId={agencyId}
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </div>
  );
}
