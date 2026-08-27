import { Case } from "../models/Case.js";
import { resolveToggle, resolveConfig } from "../settings/service.js";

const lastBurst = new Map(); // userId -> { text, at }
const lastSubmitAt = new Map(); // userId -> ms

function startOfDayMs(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

async function limitNumber(key, fallback) {
  const raw = (await resolveConfig(key, process.env, String(fallback))).value;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function checkSubmitAllowed(telegramUserId) {
  if (!(await resolveToggle("abuseGuardsEnabled"))) {
    return { ok: true };
  }
  const userId = String(telegramUserId);
  const maxHour = await limitNumber("abuseMaxPerHour", 5);
  const maxDay = await limitNumber("abuseMaxPerDay", 15);
  const cooldownSec = await limitNumber("abuseCooldownSec", 60);

  const last = lastSubmitAt.get(userId) || 0;
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
  const [hourCount, dayCount] = await Promise.all([
    Case.countDocuments({
      "reporter.telegramUserId": userId,
      createdAt: { $gte: hourAgo },
    }),
    Case.countDocuments({
      "reporter.telegramUserId": userId,
      createdAt: { $gte: dayStart },
    }),
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

export function markSubmitSuccess(telegramUserId) {
  lastSubmitAt.set(String(telegramUserId), Date.now());
}

/** Soft-drop identical bursts within 3s */
export function isDuplicateBurst(telegramUserId, text) {
  const userId = String(telegramUserId);
  const key = String(text || "").trim().toLowerCase();
  if (!key) return false;
  const prev = lastBurst.get(userId);
  const now = Date.now();
  lastBurst.set(userId, { text: key, at: now });
  if (prev && prev.text === key && now - prev.at < 3000) return true;
  return false;
}
