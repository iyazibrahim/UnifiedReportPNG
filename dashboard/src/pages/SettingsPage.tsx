import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, getToken } from "@/lib/api";
import { decodeJwtPayload } from "@/lib/agencyAuth";
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
      { key: "whatsappBotEnabled", label: "WhatsApp bot" },
      { key: "llmClassificationEnabled", label: "LLM classification" },
      { key: "keywordFallbackEnabled", label: "Keyword fallback" },
      { key: "nominatimEnabled", label: "Nominatim reverse geocode" },
      { key: "mockDispatchEnabled", label: "Agency dispatch" },
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
  { key: "publicBaseUrl", label: "Public base URL (for WhatsApp webhook)" },
  { key: "whatsappPhoneNumberId", label: "WhatsApp phone number ID" },
  { key: "nominatimUserAgent", label: "Nominatim user agent" },
  { key: "mockPortalPin", label: "Portal PIN (optional)" },
  { key: "abuseMaxPerHour", label: "Abuse max per hour" },
  { key: "abuseMaxPerDay", label: "Abuse max per day" },
  { key: "abuseCooldownSec", label: "Abuse cooldown (sec)" },
  { key: "whatsappStatusTemplateName", label: "WhatsApp status template (Meta utility)" },
];

const SECRET_FIELDS = [
  { key: "telegramBotToken", label: "Telegram bot token" },
  { key: "telegramWebhookSecret", label: "Telegram webhook secret" },
  { key: "whatsappAccessToken", label: "WhatsApp access token" },
  { key: "whatsappAppSecret", label: "WhatsApp app secret" },
  { key: "whatsappVerifyToken", label: "WhatsApp verify token" },
  { key: "openRouterApiKey", label: "OpenRouter API key" },
  { key: "pearlApiKey", label: "Pearl API key" },
  { key: "aspireApiKey", label: "Aspire API key" },
  { key: "myjalanApiKey", label: "MyJalan API key" },
  { key: "pbappApiKey", label: "PBAPP API key" },
  { key: "epintasApiKey", label: "ePINTAS API key" },
];

type AdminUser = {
  _id: string;
  username: string;
  role: string;
  agencyId?: string | null;
  displayName?: string;
  disabled?: boolean;
};

export function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<
    "features" | "config" | "secrets" | "governance" | "users"
  >("features");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [governance, setGovernance] = useState({
    dataControllerName: "",
    superAdminNames: "",
    retentionYearsMetadata: "7",
    retentionYearsPhotos: "2",
    slaHoursJson: "{}",
    vendorAccessNotes: "",
  });
  const [govReady, setGovReady] = useState(false);

  const adminClaims = decodeJwtPayload(getToken() || "");
  const isSuperAdmin = adminClaims?.role === "super_admin";

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
    api<{
      governance: typeof governance;
      ready: boolean;
    }>("/api/admin/governance")
      .then((res) => {
        setGovernance(res.governance);
        setGovReady(res.ready);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "users") return;
    setUsersLoading(true);
    api<{ items: AdminUser[] }>("/api/admin/users")
      .then((res) => setUsers(res.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setUsersLoading(false));
  }, [tab]);

  async function resetUserPasswordSubmit(userId: string) {
    if (!resetPassword || resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      toast.success("Password reset");
      setResetUserId(null);
      setResetPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveGovernance() {
    setSaving(true);
    try {
      const res = await api<{ governance: typeof governance; ready: boolean }>(
        "/api/admin/governance",
        { method: "PATCH", body: JSON.stringify(governance) }
      );
      setGovernance(res.governance);
      setGovReady(res.ready);
      toast.success("Governance saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

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
            ["governance", "Ownership & policy"],
            ["users", "Users"],
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
            <Alert>
              <AlertTitle>WhatsApp webhook URL</AlertTitle>
              <AlertDescription>
                {(config.publicBaseUrl || "").replace(/\/$/, "")
                  ? `${String(config.publicBaseUrl).replace(/\/$/, "")}/whatsapp/webhook`
                  : "Set Public base URL above — then paste {base}/whatsapp/webhook into Meta Developer Console."}
                {data.secrets.whatsappVerifyToken?.configured
                  ? " Verify token is already configured (see API keys)."
                  : " A verify token is auto-generated on first boot if left empty."}
              </AlertDescription>
            </Alert>
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

      {tab === "users" ? (
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Agency operators and admin accounts. Password reset requires
              super-admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usersLoading ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Loading users…
              </p>
            ) : users.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No users found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Username</th>
                      <th className="pb-2 pr-4 font-medium">Role</th>
                      <th className="pb-2 pr-4 font-medium">Agency</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{u.username}</td>
                        <td className="py-2 pr-4">{u.role}</td>
                        <td className="py-2 pr-4">{u.agencyId || "—"}</td>
                        <td className="py-2">
                          {isSuperAdmin ? (
                            resetUserId === u._id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  type="password"
                                  placeholder="New password"
                                  value={resetPassword}
                                  onChange={(e) =>
                                    setResetPassword(e.target.value)
                                  }
                                  className="min-h-9 max-w-[180px]"
                                  autoComplete="new-password"
                                />
                                <Button
                                  size="sm"
                                  disabled={saving}
                                  onClick={() =>
                                    resetUserPasswordSubmit(u._id)
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setResetUserId(null);
                                    setResetPassword("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setResetUserId(u._id);
                                  setResetPassword("");
                                }}
                              >
                                Reset password
                              </Button>
                            )
                          ) : (
                            <span className="text-xs text-[var(--color-muted-foreground)]">
                              Super-admin only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "governance" ? (
        <Card>
          <CardHeader>
            <CardTitle>Ownership & policy</CardTitle>
            <CardDescription>
              Pending owner confirmation — required before public go-live.
              {govReady ? " Ready." : " Not ready yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Data controller (legal entity)</Label>
              <Input
                value={governance.dataControllerName}
                onChange={(e) =>
                  setGovernance((g) => ({
                    ...g,
                    dataControllerName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Super-admin names (comma-separated)</Label>
              <Input
                value={governance.superAdminNames}
                onChange={(e) =>
                  setGovernance((g) => ({
                    ...g,
                    superAdminNames: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Retention years (metadata)</Label>
                <Input
                  value={governance.retentionYearsMetadata}
                  onChange={(e) =>
                    setGovernance((g) => ({
                      ...g,
                      retentionYearsMetadata: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Retention years (photos)</Label>
                <Input
                  value={governance.retentionYearsPhotos}
                  onChange={(e) =>
                    setGovernance((g) => ({
                      ...g,
                      retentionYearsPhotos: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>SLA hours per agency (JSON)</Label>
              <Input
                value={governance.slaHoursJson}
                onChange={(e) =>
                  setGovernance((g) => ({
                    ...g,
                    slaHoursJson: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Vendor access notes</Label>
              <Input
                value={governance.vendorAccessNotes}
                onChange={(e) =>
                  setGovernance((g) => ({
                    ...g,
                    vendorAccessNotes: e.target.value,
                  }))
                }
              />
            </div>
            <Button
              className="w-fit"
              onClick={saveGovernance}
              disabled={saving}
            >
              Save governance
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Separator />
      {tab !== "governance" && tab !== "users" ? (
        <Button
          className="min-h-11 w-fit"
          onClick={save}
          disabled={saving || !data}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      ) : null}
    </div>
  );
}
