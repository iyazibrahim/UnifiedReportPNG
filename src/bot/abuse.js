import { Case, reporterFilter } from "../models/Case.js";
import { resolveToggle, resolveConfig } from "../settings/service.js";

const lastBurst = new Map(); // key -> { text, at }
const lastSubmitAt = new Map(); // key -> ms

function abuseKey(channel, channelUserId) {
  return `${channel || "telegram"}:${channelUserId}`;
}

function startOfDayMs(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

async function limitNumber(key, fallback) {
  const raw = (await resolveConfig(key, process.env, String(fallback))).value;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function checkSubmitAllowed(channel, channelUserId) {
  // Back-compat: checkSubmitAllowed(telegramUserId)
  if (channelUserId === undefined) {
    channelUserId = channel;
    channel = "telegram";
  }
  if (!(await resolveToggle("abuseGuardsEnabled"))) {
    return { ok: true };
  }
  const userId = String(channelUserId);
  const key = abuseKey(channel, userId);
  const maxHour = await limitNumber("abuseMaxPerHour", 5);
  const maxDay = await limitNumber("abuseMaxPerDay", 15);
  const cooldownSec = await limitNumber("abuseCooldownSec", 60);

  const last = lastSubmitAt.get(key) || 0;
  const sinceCooldown = Date.now() - last;
  if (sinceCooldown < cooldownSec * 1000) {
    const wait = Math.ceil((cooldownSec * 1000 - sinceCooldown) / 1000);
    return {
      ok: false,
      reason: "cooldown",
      message: `Sila tunggu ${wait} saat sebelum menghantar aduan baharu.`,
    };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayStart = new Date(startOfDayMs());
  const filter = reporterFilter(channel, userId);
  const [hourCount, dayCount] = await Promise.all([
    Case.countDocuments({ ...filter, createdAt: { $gte: hourAgo } }),
    Case.countDocuments({ ...filter, createdAt: { $gte: dayStart } }),
  ]);

  if (hourCount >= maxHour) {
    return {
      ok: false,
      reason: "hour_limit",
      message:
        "Had aduan sejam telah dicapai. Sila cuba lagi kemudian. Terima kasih.",
    };
  }
  if (dayCount >= maxDay) {
    return {
      ok: false,
      reason: "day_limit",
      message:
        "Had aduan harian telah dicapai. Sila cuba lagi esok. Terima kasih.",
    };
  }
  return { ok: true };
}

export function markSubmitSuccess(channel, channelUserId) {
  if (channelUserId === undefined) {
    channelUserId = channel;
    channel = "telegram";
  }
  lastSubmitAt.set(abuseKey(channel, channelUserId), Date.now());
}

/** Soft-drop identical bursts within 3s */
export function isDuplicateBurst(channel, channelUserId, text) {
  if (text === undefined) {
    text = channelUserId;
    channelUserId = channel;
    channel = "telegram";
  }
  const key = abuseKey(channel, channelUserId);
  const textKey = String(text || "").trim().toLowerCase();
  if (!textKey) return false;
  const prev = lastBurst.get(key);
  const now = Date.now();
  lastBurst.set(key, { text: textKey, at: now });
  if (prev && prev.text === textKey && now - prev.at < 3000) return true;
  return false;
}
