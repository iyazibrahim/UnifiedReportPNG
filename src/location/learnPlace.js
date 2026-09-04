/**
 * Learn landmarks from citizen-confirmed pins.
 */
import { Landmark } from "../models/Landmark.js";
import { locateDaerah } from "../jurisdiction/daerah.js";
import { locateRegion } from "../jurisdiction/region.js";
import { invalidateLandmarkCache } from "./landmarkStore.js";

const NEAR_M = 80;

const GENERIC_NAMES = new Set([
  "road",
  "residential",
  "unclassified",
  "primary",
  "secondary",
  "tertiary",
  "trunk",
  "path",
  "footway",
  "junction",
  "intersection",
  "persimpangan",
  "jalan",
  "street",
]);

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

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGenericPlaceName(name) {
  const n = normalize(name);
  if (!n || n.length < 3) return true;
  if (GENERIC_NAMES.has(n)) return true;
  if (/^(jalan|jln|lorong|lebuh)\s*$/i.test(n)) return true;
  return false;
}

function pickCanonicalName(location, rawAlias) {
  const candidates = [
    location?.placeName,
    location?.landmark,
    location?.display_name?.split(",")[0],
    rawAlias,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  for (const c of candidates) {
    if (!isGenericPlaceName(c)) return c.slice(0, 120);
  }
  return null;
}

/**
 * After citizen taps Ya on a place pin, upsert Landmark or add alias.
 * @returns {Promise<object|null>}
 */
export async function learnLandmarkFromConfirm(location, {
  rawAlias = null,
} = {}) {
  if (!location?.confirmed) return null;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = pickCanonicalName(location, rawAlias);
  if (!name) return null;

  const alias = String(rawAlias || location.landmark || "").trim();
  const daerah = location.daerah || locateDaerah(lat, lng);
  const sideRaw = locateRegion(lat, lng);
  const side = sideRaw === "outside" ? "pulau" : sideRaw;

  try {
    // Prefer existing landmark by id if we resolved from DB
    if (location.landmarkId) {
      const existing = await Landmark.findById(location.landmarkId);
      if (existing) {
        if (alias && normalize(alias) !== normalize(existing.name)) {
          const aliases = existing.aliases || [];
          if (!aliases.some((a) => normalize(a) === normalize(alias))) {
            existing.aliases = [...aliases, alias.slice(0, 120)];
            await existing.save();
            invalidateLandmarkCache();
          }
        }
        return existing.toObject();
      }
    }

    const nearby = await Landmark.find({
      lat: { $gte: lat - 0.002, $lte: lat + 0.002 },
      lng: { $gte: lng - 0.002, $lte: lng + 0.002 },
    }).limit(50);

    let best = null;
    let bestDist = Infinity;
    for (const lm of nearby) {
      const d = haversineM(lat, lng, lm.lat, lm.lng);
      if (d > NEAR_M) continue;
      const nameHit =
        normalize(lm.name) === normalize(name) ||
        (lm.aliases || []).some((a) => normalize(a) === normalize(name)) ||
        (alias &&
          (normalize(lm.name) === normalize(alias) ||
            (lm.aliases || []).some((a) => normalize(a) === normalize(alias))));
      if (nameHit || d < bestDist) {
        if (nameHit || d < 40) {
          best = lm;
          bestDist = d;
          if (nameHit) break;
        }
      }
    }

    if (best && bestDist <= NEAR_M) {
      const toAdd = [alias, name].filter(
        (a) =>
          a &&
          normalize(a) !== normalize(best.name) &&
          !(best.aliases || []).some((x) => normalize(x) === normalize(a))
      );
      if (toAdd.length) {
        best.aliases = [...(best.aliases || []), ...toAdd.map((a) => a.slice(0, 120))];
        await best.save();
        invalidateLandmarkCache();
      }
      return best.toObject();
    }

    // Only create new row for named POI resolutions (not pure GPS without name)
    const method = String(location.method || location.source || "");
    const fromNamedPlace =
      method.includes("landmark") ||
      method.includes("text_geocode") ||
      Boolean(location.placeName) ||
      Boolean(location.landmark);
    if (!fromNamedPlace && !alias) return null;

    const created = await Landmark.create({
      name,
      aliases: alias && normalize(alias) !== normalize(name) ? [alias.slice(0, 120)] : [],
      category: "landmark",
      lat,
      lng,
      daerah: daerah || "unknown",
      side,
      source: "citizen_confirmed",
      address: location.display_name || `${name}, Pulau Pinang`,
    });
    invalidateLandmarkCache();
    return created.toObject();
  } catch {
    return null;
  }
}
