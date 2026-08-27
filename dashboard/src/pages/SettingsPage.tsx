import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Switch, Separator } from "@/components/ui/misc";

type SettingsResponse = {
  toggles: Record<string, boolean>;
  config: Record<string, { value: string; source: string | null; overridden: boolean }>;
  secrets: Record<
    string,
    { configured: boolean; hint: string | null; source: string | null; overridden: boolean }
  >;
};

const TOGGLE_GROUPS: Array<{ title: string; keys: Array<{ key: string; label: string }> }> = [
  {
    title: "Channels & classification",
    keys: [
      { key: "telegramBotEnabled", label: "Telegram bot" },
      { key: "llmClassificationEnabled", label: "LLM classification" },
      { key: "keywordFallbackEnabled", label: "Keyword fallback" },
      { key: "nominatimEnabled", label: "Nominatim reverse geocode" },
      { key: "mockDispatchEnabled", label: "Mock agency dispatch" },
    ],
  },
  {
    title: "Per-agency dispatch",
    keys: [
      { key: "pearl_mbpp", label: "Pearl / MBPP" },
      { key: "aspire_mbsp", label: "Aspire / MBSP" },
      { key: "myjalan", label: "MyJalan" },
      { key: "pbapp", label: "PBAPP" },
      { key: "epintas", label: "ePINTAS" },
    ],
  },
];

const CONFIG_FIELDS = [
  { key: "openRouterModel", label: "OpenRouter model" },
  { key: "telegramWebhookUrl", label: "Telegram webhook URL" },
  { key: "nominatimUserAgent", label: "Nominatim user agent" },
  { key: "mockPortalPin", label: "Mock portal PIN (optional)" },
];

const SECRET_FIELDS = [
  { key: "telegramBotToken", label: "Telegram bot token" },
  { key: "telegramWebhookSecret", label: "Telegram webhook secret" },
  { key: "openRouterApiKey", label: "OpenRouter API key" },
  { key: "pearlApiKey", label: "Pearl API key (future)" },
  { key: "aspireApiKey", label: "Aspire API key (future)" },
  { key: "myjalanApiKey", label: "MyJalan API key (future)" },
  { key: "pbappApiKey", label: "PBAPP API key (future)" },
  { key: "epintasApiKey", label: "ePINTAS API key (future)" },
];

export function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"features" | "config" | "secrets">("features");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SettingsResponse>("/api/admin/settings").then((res) => {
      setData(res);
      setToggles(res.toggles);
      const cfg: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.config)) cfg[k] = v.value || "";
      setConfig(cfg);
    });
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const body: Record<string, unknown> = {
        toggles,
        config,
      };
      const secretPatch: Record<string, string> = {};
      for (const [k, v] of Object.entries(secrets)) {
        if (v !== "") secretPatch[k] = v;
      }
      if (Object.keys(secretPatch).length) body.secrets = secretPatch;
      const res = await api<SettingsResponse>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setData(res);
      setToggles(res.toggles);
      setSecrets({});
      setMsg("Settings saved. Runtime uses dashboard values over .env.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearSecret(key: string) {
    setSaving(true);
    try {
      const res = await api<SettingsResponse>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ secrets: { [key]: "" } }),
      });
      setData(res);
      setMsg(`Cleared dashboard override for ${key} (falls back to env).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <p>Loading settings…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Dashboard overrides .env at runtime. OPS_USER / JWT_SECRET / Mongo stay in .env only.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
        {(
          [
            ["features", "Features"],
            ["config", "Configuration"],
            ["secrets", "API keys"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "features" ? (
        <div className="space-y-4">
          {TOGGLE_GROUPS.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.keys.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <Label htmlFor={key}>{label}</Label>
                    <Switch
                      id={key}
                      checked={Boolean(toggles[key])}
                      onCheckedChange={(v) =>
                        setToggles((t) => ({ ...t, [key]: v }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "config" ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Non-secret env overrides</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CONFIG_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>
                  {label}
                  {data.config[key]?.overridden ? (
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                      (dashboard)
                    </span>
                  ) : data.config[key]?.source === "env" ? (
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                      (from env)
                    </span>
                  ) : null}
                </Label>
                <Input
                  id={key}
                  value={config[key] || ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "secrets" ? (
        <Card>
          <CardHeader>
            <CardTitle>API keys / secrets</CardTitle>
            <CardDescription>
              Leave blank to keep current value. Clear override to fall back to .env.
              Changing Telegram token while polling may require process restart.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {SECRET_FIELDS.map(({ key, label }) => {
              const meta = data.secrets[key];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={key}>{label}</Label>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {meta?.configured
                        ? `${meta.hint} · ${meta.overridden ? "dashboard" : meta.source}`
                        : "not configured"}
                    </span>
                  </div>
                  <Input
                    id={key}
                    type="password"
                    placeholder={meta?.configured ? "Enter new value to replace" : "Paste secret"}
                    value={secrets[key] || ""}
                    onChange={(e) =>
                      setSecrets((s) => ({ ...s, [key]: e.target.value }))
                    }
                    autoComplete="off"
                  />
                  {meta?.overridden ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => clearSecret(key)}
                    >
                      Clear dashboard override
                    </Button>
                  ) : null}
                  <Separator />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {msg ? <p className="text-sm text-[var(--color-primary)]">{msg}</p> : null}
        {error ? (
          <p className="text-sm text-[var(--color-destructive)]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
