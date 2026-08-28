import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
    <div className="relative flex min-h-[200px] flex-1 flex-col overflow-hidden md:min-h-0">
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
      <div className="absolute inset-0 bg-[oklch(0.22_0.04_240/0.42)]" />
      <div className="relative z-10 flex flex-1 flex-col p-6 md:p-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-sm font-bold tracking-tight text-white backdrop-blur-sm">
            1P
          </div>
          <span className="text-sm font-medium text-white/90">
            OnePenang Dashboard
          </span>
        </div>
        <div className="mt-auto">
          <p className="font-serif-display max-w-xs text-2xl leading-snug font-semibold text-white md:text-3xl">
            {SLIDES[slide].tagline}
          </p>
          <div className="mt-6 flex gap-2">
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-4 md:p-8">
      <div
        className="relative flex w-full max-w-5xl overflow-hidden rounded-2xl bg-[var(--color-card)] shadow-[0_8px_40px_oklch(0.22_0.04_240/0.08)] before:absolute before:top-0 before:left-0 before:z-20 before:h-full before:w-[6px] before:bg-[var(--color-primary)] after:absolute after:top-0 after:left-[6px] after:z-20 after:h-full after:w-1 after:bg-[var(--color-gold)]"
      >
        <div
          className="hidden w-[45%] shrink-0 md:flex md:flex-col"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          <LoginCarousel
            active={activeSlide}
            onSelect={setActiveSlide}
            paused={carouselPaused}
          />
        </div>

        <div className="flex w-full flex-col md:w-[55%]">
          <div
            className="relative min-h-[160px] md:hidden"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
          >
            <LoginCarousel
              active={activeSlide}
              onSelect={setActiveSlide}
              paused={carouselPaused}
            />
          </div>

          <div className="flex flex-1 flex-col justify-center px-6 py-8 md:px-10 md:py-12">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
                Sign in
              </h1>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                OnePenang Dashboard — coordinate public reports and agency operations
              </p>
            </div>

            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="user">Username</Label>
                <Input
                  id="user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="min-h-11 rounded-lg border-[var(--color-input)] bg-[var(--color-muted)]/40"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pass">Password</Label>
                <div className="relative">
                  <Input
                    id="pass"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="min-h-11 rounded-lg border-[var(--color-input)] bg-[var(--color-muted)]/40 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
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
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                className="min-h-11 w-full rounded-lg text-base"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
