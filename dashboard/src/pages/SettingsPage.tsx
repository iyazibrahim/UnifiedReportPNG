import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label, Switch, Separator } from "@/components/ui/misc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SettingsResponse = {
  toggles: Record<string, boolean>;
  config: Record<
    string,
    { value: string; source: string | null; overridden: boolean }
  >;
  secrets: Record<
    string,
    {
      configured: boolean;
      hint: string | null;
      source: string | null;
      overridden: boolean;
    }
  >;
};

const TOGGLE_GROUPS: Array<{
  title: string;
  keys: Array<{ key: string; label: string }>;
}> = [
  {
    title: "Channels & classification",
    keys: [
      { key: "telegramBotEnabled", label: "Telegram bot" },
      { key: "llmClassificationEnabled", label: "LLM classification" },
      { key: "keywordFallbackEnabled", label: "Keyword fallback" },
      { key: "nominatimEnabled", label: "Nominatim reverse geocode" },
      { key: "mockDispatchEnabled", label: "Mock agency dispatch" },
      { key: "abuseGuardsEnabled", label: "Abuse rate limits" },
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
  { key: "abuseMaxPerHour", label: "Abuse max per hour" },
  { key: "abuseMaxPerDay", label: "Abuse max per day" },
  { key: "abuseCooldownSec", label: "Abuse cooldown (sec)" },
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<SettingsResponse>("/api/admin/settings")
      .then((res) => {
        setData(res);
        setToggles(res.toggles);
        const cfg: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.config)) cfg[k] = v.value || "";
        setConfig(cfg);
      })
      .catch((e) => {
        setError(e.message);
        toast.error(e.message);
      });
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { toggles, config };
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
      toast.success("Settings saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!data && !error) {
    return (
      <p className="text-[var(--color-muted-foreground)]">Loading settings…</p>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Dashboard values override .env at runtime (except ops login / Mongo /
          JWT).
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["features", "Features"],
            ["config", "Configuration"],
            ["secrets", "API keys"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "default" : "outline"}
            className="min-h-11"
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "features" && data ? (
        <div className="flex flex-col gap-4">
          {TOGGLE_GROUPS.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {group.keys.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4"
                  >
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

      {tab === "config" && data ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Non-secret runtime values</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {CONFIG_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={config[key] || ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, [key]: e.target.value }))
                  }
                  className="min-h-11"
                />
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Source: {data.config[key]?.source || "default"}
                  {data.config[key]?.overridden ? " (overridden)" : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {tab === "secrets" && data ? (
        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Leave blank to keep existing. Stored encrypted in Mongo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {SECRET_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="password"
                  placeholder={
                    data.secrets[key]?.configured
                      ? `Configured ${data.secrets[key]?.hint || ""}`
                      : "Not set"
                  }
                  value={secrets[key] || ""}
                  onChange={(e) =>
                    setSecrets((s) => ({ ...s, [key]: e.target.value }))
                  }
                  className="min-h-11"
                  autoComplete="off"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Separator />
      <Button
        className="min-h-11 w-fit"
        onClick={save}
        disabled={saving || !data}
      >
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
