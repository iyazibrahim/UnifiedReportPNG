/**
 * Street DB cache + fuzzy match near pin.
 */
import mongoose from "mongoose";
import { Street } from "../models/Street.js";
import { locateDaerah } from "../jurisdiction/daerah.js";

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function scoreStreetMatch(query, street) {
  const q = normalize(query);
  if (!q) return 0;
  const names = [street.name, ...(street.aliases || [])].map(normalize);
  let best = 0;
  for (const name of names) {
    if (!name) continue;
    if (q === name) best = Math.max(best, 1);
    else if (name.includes(q) || q.includes(name)) best = Math.max(best, 0.88);
    else {
      const qt = q.split(" ").filter((t) => t.length > 1);
      const nt = new Set(name.split(" ").filter((t) => t.length > 1));
      if (qt.length) {
        const hit = qt.filter((t) => nt.has(t)).length;
        const overlap = hit / qt.length;
        if (overlap >= 0.6) best = Math.max(best, 0.5 + overlap * 0.4);
      }
    }
  }
  return best;
}

export function invalidateStreetCache() {
  cache = null;
  cacheAt = 0;
}

export async function loadStreetsCached({ force = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return cache || [];
  }
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) return cache;
  try {
    cache = await Street.find({ disabled: { $ne: true } }).lean();
    cacheAt = now;
    return cache;
  } catch {
    return cache || [];
  }
}

/**
 * Fuzzy match streets near pin (default 1.5 km) or same daerah.
 */
export async function matchStreetDb(
  query,
  { lat, lng, daerah, minScore = 0.72, maxDistM = 1500, limit = 3 } = {}
) {
  const list = await loadStreetsCached();
  if (!list.length) return [];
  const scored = [];
  for (const st of list) {
    let score = scoreStreetMatch(query, st);
    if (score < minScore) continue;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const dist = haversineM(lat, lng, st.lat, st.lng);
      if (dist > maxDistM) {
        if (daerah && st.daerah === daerah && dist <= 5000) {
          score *= 0.9;
        } else continue;
      } else if (dist <= 500) {
        score = Math.min(1, score + 0.1);
      }
    } else if (daerah && st.daerah && st.daerah !== daerah) {
      continue;
    }
    scored.push({
      streetName: st.name,
      lat: st.lat,
      lng: st.lng,
      display_name: st.name,
      score,
      method: "street_db",
      streetId: String(st._id),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Upsert street after citizen confirm.
 */
export async function learnStreetFromConfirm({
  name,
  alias,
  lat,
  lng,
  daerah,
  source = "citizen_confirmed",
} = {}) {
  const road = String(name || "").trim();
  if (!road || road.length < 3) return null;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const latN = Number(lat);
  const lngN = Number(lng);
  const daerahId = daerah || locateDaerah(latN, lngN) || "unknown";
  const aliasStr = String(alias || "").trim();

  try {
    const nearby = await Street.find({
      disabled: { $ne: true },
      lat: { $gte: latN - 0.01, $lte: latN + 0.01 },
      lng: { $gte: lngN - 0.01, $lte: lngN + 0.01 },
    }).limit(40);

    let best = null;
    let bestDist = Infinity;
    for (const st of nearby) {
      const d = haversineM(latN, lngN, st.lat, st.lng);
      if (d > 800) continue;
      const nameHit =
        normalize(st.name) === normalize(road) ||
        (st.aliases || []).some((a) => normalize(a) === normalize(road));
      if (nameHit && d < bestDist) {
        best = st;
        bestDist = d;
      }
    }

    if (best) {
      best.confirmCount = (best.confirmCount || 1) + 1;
      if (
        aliasStr &&
        normalize(aliasStr) !== normalize(best.name) &&
        !(best.aliases || []).some((a) => normalize(a) === normalize(aliasStr))
      ) {
        best.aliases = [...(best.aliases || []), aliasStr.slice(0, 120)];
      }
      await best.save();
      invalidateStreetCache();
      return best.toObject();
    }

    const created = await Street.create({
      name: road.slice(0, 120),
      aliases:
        aliasStr && normalize(aliasStr) !== normalize(road)
          ? [aliasStr.slice(0, 120)]
          : [],
      lat: latN,
      lng: lngN,
      daerah: daerahId,
      source,
      confirmCount: 1,
    });
    invalidateStreetCache();
    return created.toObject();
  } catch {
    return null;
  }
}
