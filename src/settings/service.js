import mongoose from "mongoose";
import crypto from "node:crypto";
import { Settings, defaultToggles } from "../models/Settings.js";

const SECRET_KEYS = [
  "telegramBotToken",
  "telegramWebhookSecret",
  "whatsappAccessToken",
  "whatsappAppSecret",
  "whatsappVerifyToken",
  "openRouterApiKey",
  "pearlApiKey",
  "aspireApiKey",
  "myjalanApiKey",
  "pbappApiKey",
  "epintasApiKey",
];

const CONFIG_KEYS = [
  "openRouterModel",
  "nominatimUserAgent",
  "telegramWebhookUrl",
  "publicBaseUrl",
  "whatsappPhoneNumberId",
  "mockPortalPin",
  "abuseMaxPerHour",
  "abuseMaxPerDay",
  "abuseCooldownSec",
  "whatsappStatusTemplateName",
];

const ENV_MAP = {
  telegramBotToken: "TELEGRAM_BOT_TOKEN",
  telegramWebhookSecret: "TELEGRAM_WEBHOOK_SECRET",
  whatsappAccessToken: "WHATSAPP_ACCESS_TOKEN",
  whatsappAppSecret: "WHATSAPP_APP_SECRET",
  whatsappVerifyToken: "WHATSAPP_VERIFY_TOKEN",
  whatsappPhoneNumberId: "WHATSAPP_PHONE_NUMBER_ID",
  publicBaseUrl: "PUBLIC_BASE_URL",
  openRouterApiKey: "OPENROUTER_API_KEY",
  openRouterModel: "OPENROUTER_MODEL",
  nominatimUserAgent: "NOMINATIM_USER_AGENT",
  telegramWebhookUrl: "TELEGRAM_WEBHOOK_URL",
  mockPortalPin: "MOCK_PORTAL_PIN",
  abuseMaxPerHour: "ABUSE_MAX_PER_HOUR",
  abuseMaxPerDay: "ABUSE_MAX_PER_DAY",
  abuseCooldownSec: "ABUSE_COOLDOWN_SEC",
  whatsappStatusTemplateName: "WHATSAPP_STATUS_TEMPLATE_NAME",
};

const CACHE_TTL_MS = 5_000;
let cache = { at: 0, doc: null };

function encryptionKey(env = process.env) {
  const raw =
    env.SETTINGS_ENCRYPTION_KEY || env.JWT_SECRET || "dev-settings-key";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain, env = process.env) {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    encryptionKey(env),
    iv
  );
  const enc = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored, env = process.env) {
  if (!stored) return "";
  if (!String(stored).startsWith("enc:")) return String(stored);
  const [, ivB64, tagB64, dataB64] = String(stored).split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(env),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value) {
  if (!value) return { configured: false, hint: null };
  const s = String(value);
  const hint = s.length <= 4 ? "••••" : `••••${s.slice(-4)}`;
  return { configured: true, hint };
}

export function invalidateSettingsCache() {
  cache = { at: 0, doc: null };
}

function memoryDoc() {
  return {
    toggles: defaultToggles(),
    config: {},
    secrets: {},
  };
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

async function loadDoc() {
  const now = Date.now();
  if (cache.doc && now - cache.at < CACHE_TTL_MS) return cache.doc;
  if (!dbReady()) {
    const doc = memoryDoc();
    cache = { at: now, doc };
    return doc;
  }
  try {
    let doc = await Settings.findOne({ singletonKey: "default" });
    if (!doc) {
      doc = await Settings.create({
        singletonKey: "default",
        toggles: defaultToggles(),
        config: {},
        secrets: {},
      });
    }
    cache = { at: now, doc };
    return doc;
  } catch {
    return memoryDoc();
  }
}

export async function ensureSettingsSeeded() {
  if (!dbReady()) return memoryDoc();
  const doc = await loadDoc();
  let changed = false;
  if (!doc.toggles || Object.keys(doc.toggles).length === 0) {
    doc.toggles = defaultToggles();
    changed = true;
  }
  for (const key of Object.keys(defaultToggles())) {
    if (doc.toggles[key] === undefined) {
      doc.toggles[key] = true;
      changed = true;
    }
  }
  // Auto-generate WhatsApp verify token once if missing (env + DB empty)
  const existingVerify = pickDbSecret(doc, "whatsappVerifyToken", process.env);
  const envVerify = process.env.WHATSAPP_VERIFY_TOKEN || "";
  if (!existingVerify && !envVerify) {
    doc.secrets = doc.secrets || {};
    doc.secrets.whatsappVerifyToken = encryptSecret(
      crypto.randomBytes(16).toString("hex"),
      process.env
    );
    doc.markModified("secrets");
    changed = true;
  }
  if (changed && typeof doc.save === "function") {
    await doc.save();
    invalidateSettingsCache();
  }
  return doc;
}

function pickDbSecret(doc, key, env) {
  const stored = doc?.secrets?.[key];
  if (stored) return decryptSecret(stored, env);
  return "";
}

function pickDbConfig(doc, key) {
  const v = doc?.config?.[key];
  return v == null ? "" : String(v);
}

export async function resolveSecret(key, env = process.env) {
  const doc = await loadDoc();
  const fromDb = pickDbSecret(doc, key, env);
  if (fromDb) return { value: fromDb, source: "dashboard" };
  const envKey = ENV_MAP[key];
  const fromEnv = envKey ? env[envKey] || "" : "";
  if (fromEnv) return { value: fromEnv, source: "env" };
  return { value: "", source: null };
}

export async function resolveConfig(key, env = process.env, fallback = "") {
  const doc = await loadDoc();
  const fromDb = pickDbConfig(doc, key);
  if (fromDb) return { value: fromDb, source: "dashboard" };
  const envKey = ENV_MAP[key];
  const fromEnv = envKey ? env[envKey] || "" : "";
  if (fromEnv) return { value: fromEnv, source: "env" };
  return { value: fallback, source: fallback ? "default" : null };
}

export async function resolveToggle(key) {
  const doc = await loadDoc();
  const toggles = { ...defaultToggles(), ...(doc.toggles || {}) };
  return Boolean(toggles[key]);
}

export async function getResolvedRuntime(env = process.env) {
  const doc = await loadDoc();
  const secrets = {};
  for (const key of SECRET_KEYS) {
    secrets[key] = await resolveSecret(key, env);
  }
  const config = {};
  for (const key of CONFIG_KEYS) {
    const fallback =
      key === "openRouterModel"
        ? "openai/gpt-4o-mini"
        : key === "nominatimUserAgent"
          ? "UnifiedReportPenang/1.0"
          : "";
    config[key] = await resolveConfig(key, env, fallback);
  }
  return {
    toggles: { ...defaultToggles(), ...(doc.toggles || {}) },
    secrets,
    config,
  };
}

export async function getPublicSettings(env = process.env) {
  const runtime = await getResolvedRuntime(env);
  const secrets = {};
  for (const key of SECRET_KEYS) {
    const { value, source } = runtime.secrets[key];
    secrets[key] = {
      ...maskSecret(value),
      source: value ? source : null,
      overridden: source === "dashboard",
    };
  }
  const config = {};
  for (const key of CONFIG_KEYS) {
    const { value, source } = runtime.config[key];
    config[key] = { value, source, overridden: source === "dashboard" };
  }
  return {
    toggles: runtime.toggles,
    config,
    secrets,
  };
}

export async function patchSettings(body, { updatedBy } = {}, env = process.env) {
  if (!dbReady()) {
    throw new Error("Database not connected");
  }
  const doc = await loadDoc();
  if (body.toggles && typeof body.toggles === "object") {
    doc.toggles = { ...defaultToggles(), ...doc.toggles, ...body.toggles };
    doc.markModified("toggles");
  }
  if (body.config && typeof body.config === "object") {
    doc.config = doc.config || {};
    for (const key of CONFIG_KEYS) {
      if (body.config[key] === undefined) continue;
      const val = body.config[key];
      if (val === "") {
        doc.config[key] = "";
      } else if (val != null) {
        doc.config[key] = String(val);
      }
    }
    doc.markModified("config");
  }
  if (body.secrets && typeof body.secrets === "object") {
    doc.secrets = doc.secrets || {};
    for (const key of SECRET_KEYS) {
      if (body.secrets[key] === undefined || body.secrets[key] === null) {
        continue;
      }
      const val = body.secrets[key];
      if (val === "") {
        doc.secrets[key] = "";
      } else {
        doc.secrets[key] = encryptSecret(String(val), env);
      }
    }
    doc.markModified("secrets");
  }
  if (updatedBy) doc.updatedBy = updatedBy;
  await doc.save();
  invalidateSettingsCache();
  return getPublicSettings(env);
}

export { SECRET_KEYS, CONFIG_KEYS, ENV_MAP, defaultToggles };
