import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { agencyApi, setAgencyToken } from "@/lib/agencyAuth";
import { AGENCY_THEME } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function AgencyLoginPage() {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const navigate = useNavigate();
  const [username, setUsername] = useState(`${agencyId}_ops`);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const msg = sessionStorage.getItem("agency_login_toast");
    if (msg) {
      toast.info(msg);
      sessionStorage.removeItem("agency_login_toast");
    }
  }, []);

  if (!theme) return <p className="p-6">Unknown agency</p>;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await agencyApi<{ token: string }>(
        agencyId,
        "/api/agencies/login",
        {
          method: "POST",
          auth: false,
          body: JSON.stringify({ username, password }),
        }
      );
      setAgencyToken(agencyId, res.token);
      navigate(`/portals/${agencyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div
        className="relative flex min-h-[220px] flex-1 flex-col justify-between p-6 text-white md:min-h-screen md:p-10"
        style={{
          background: `linear-gradient(145deg, ${theme.accent} 0%, ${theme.accent}cc 45%, ${theme.gradientFrom} 100%)`,
        }}
      >
        <div className="relative z-10">
          <img
            src={theme.logo}
            alt=""
            className="mb-6 size-16 rounded-xl bg-white p-2 object-contain shadow-md"
          />
          <p className="text-xs uppercase tracking-widest text-white/80">
            Portal agensi
          </p>
          <h1 className="mt-2 font-serif-display text-2xl font-semibold md:text-3xl">
            {theme.label}
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/90 md:text-base">
            {theme.mission}
          </p>
          <p className="mt-2 max-w-md text-xs text-white/75 md:text-sm">
            {theme.blurb}
          </p>
        </div>
        <p className="relative z-10 mt-8 text-xs text-white/60">
          Saluran Aduan Bersatu Pulau Pinang
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--color-background)] p-6 md:p-10">
        <Card className="w-full max-w-md border-[var(--color-border)] shadow-lg">
          <CardHeader>
            <CardTitle>Log masuk</CardTitle>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Akses peti masuk aduan untuk {theme.short}.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="username">Nama pengguna</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata laluan</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="min-h-11 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-muted-foreground)]"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyi" : "Tunjuk"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={busy}
                style={{ background: theme.accent }}
              >
                {busy ? "Sedang log masuk…" : "Log masuk"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
