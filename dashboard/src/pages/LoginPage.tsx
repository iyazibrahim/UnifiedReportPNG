import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const ADMIN_THEME = {
  accent: "oklch(0.52 0.14 235)",
};

const SLIDES = [
  {
    image: "/login/slide-1.svg",
    tagline: "Laporan awam, satu saluran.",
  },
  {
    image: "/login/slide-2.svg",
    tagline: "Dari rakyat ke agensi — pantas dan telus.",
  },
  {
    image: "/login/slide-3.svg",
    tagline: "Pulau Pinang, operasi bersatu.",
  },
] as const;

const AUTO_ADVANCE_MS = 8000;

function LoginCarousel({
  active,
  onSelect,
  paused,
}: {
  active: number;
  onSelect: (i: number) => void;
  paused: boolean;
}) {
  const [slide, setSlide] = useState(active);

  useEffect(() => {
    setSlide(active);
  }, [active]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setSlide((s) => {
        const next = (s + 1) % SLIDES.length;
        onSelect(next);
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, onSelect]);

  return (
    <div className="relative flex min-h-[220px] flex-1 flex-col overflow-hidden md:min-h-screen">
      {SLIDES.map((s, i) => (
        <div
          key={s.image}
          className={cn(
            "absolute inset-0 bg-cover bg-center transition-opacity duration-700",
            i === slide ? "opacity-100" : "opacity-0"
          )}
          style={{ backgroundImage: `url(${s.image})` }}
          aria-hidden={i !== slide}
        />
      ))}
      <div className="absolute inset-0 bg-[oklch(0.22_0.04_240/0.52)]" />
      <div className="relative z-10 flex flex-1 flex-col justify-between p-6 md:p-10">
        <div>
          <div className="mb-6 flex size-16 items-center justify-center rounded-xl bg-white p-2 text-xl font-bold tracking-tight text-[var(--color-primary)] shadow-md">
            1P
          </div>
          <p className="text-xs uppercase tracking-widest text-white/80">
            Pentadbiran
          </p>
          <h1 className="mt-2 font-serif-display text-2xl font-semibold text-white md:text-3xl">
            OnePenang Dashboard
          </h1>
        </div>
        <div>
          <p className="max-w-md font-serif-display text-xl font-semibold leading-snug text-white md:text-2xl">
            {SLIDES[slide].tagline}
          </p>
          <div className="mt-5 flex gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => {
                  setSlide(i);
                  onSelect(i);
                }}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === slide
                    ? "w-8 bg-[var(--color-gold)]"
                    : "w-5 bg-white/35 hover:bg-white/50"
                )}
              />
            ))}
          </div>
          <p className="mt-6 text-xs text-white/60">
            Saluran Aduan Bersatu Pulau Pinang
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("ops");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{ token: string }>("/api/admin/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ username, password }),
      });
      setToken(res.token);
      toast.success("Signed in");
      navigate("/admin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div
        className="flex flex-1 flex-col"
        onMouseEnter={() => setCarouselPaused(true)}
        onMouseLeave={() => setCarouselPaused(false)}
      >
        <LoginCarousel
          active={activeSlide}
          onSelect={setActiveSlide}
          paused={carouselPaused}
        />
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--color-background)] p-6 md:p-10">
        <Card className="w-full max-w-md border-[var(--color-border)] shadow-lg">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Access the operations dashboard and agency coordination tools.
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
                <Label htmlFor="user">Username</Label>
                <Input
                  id="user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">Password</Label>
                <div className="relative">
                  <Input
                    id="pass"
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                disabled={loading}
                style={{ background: ADMIN_THEME.accent }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
