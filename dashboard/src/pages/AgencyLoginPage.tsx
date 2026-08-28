import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { agencyApi, setAgencyToken } from "@/lib/agencyAuth";
import { AGENCY_THEME } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AgencyLoginPage() {
  const { agencyId = "" } = useParams();
  const theme = AGENCY_THEME[agencyId];
  const navigate = useNavigate();
  const [username, setUsername] = useState(`${agencyId}_ops`);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!theme) return <p className="p-6">Unknown agency</p>;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await agencyApi<{ token: string }>("/api/agencies/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ username, password }),
      });
      setAgencyToken(res.token);
      navigate(`/portals/${agencyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ ["--agency" as string]: theme.accent }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <img
              src={theme.logo}
              alt=""
              className="h-12 w-12 rounded-lg object-contain"
            />
            <div>
              <CardTitle>{theme.label}</CardTitle>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Portal agensi — log masuk
              </p>
            </div>
          </div>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata laluan</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sedang log masuk…" : "Log masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
