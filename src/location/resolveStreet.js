/**
 * Verify and resolve street names via LLM normalization + Nominatim search near pin.
 */
import { daerahLabel } from "../jurisdiction/daerah.js";
import { searchGeocodeRows } from "./geocode.js";
import { completeWithFailover } from "../ai/router.js";
import { matchStreetDb } from "./streetStore.js";

const SYSTEM = `You help verify street names for citizen reports in Pulau Pinang (Penang), Malaysia only.
Given a street name phrase in Malay/English slang, return JSON only:
{"ok":true,"streetName":"<normalized street name>","searchQueries":["..."],"confidence":0.0}
Rules:
- Normalize prefixes: Jalan/Jln, Lebuh, Lorong, Persiaran, Jalan Lama, etc.
- Scope to Penang only. Use daerah context when provided.
- Examples:
  "jalan burma" → streetName:"Jalan Burma", searchQueries:["Jalan Burma George Town Penang","Jalan Burma Penang"]
  "lebuh pantai" → "Lebuh Pantai George Town Penang"
  "jalan utama balik pulau" → "Jalan Balik Pulau Penang"
- If nonsense or outside Penang: {"ok":false,"streetName":"","searchQueries":[],"confidence":0}
- Never invent coordinates. Street name only.`;

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

function tokenOverlap(a, b) {
  const at = new Set(normalize(a).split(" ").filter((t) => t.length > 1));
  const bt = normalize(b).split(" ").filter((t) => t.length > 1);
  if (!bt.length) return 0;
  const hit = bt.filter((t) => at.has(t)).length;
  return hit / bt.length;
}

function extractStreetName(row) {
  const address = row.address || {};
  return (
    address.road ||
    address.pedestrian ||
    address.path ||
    row.name ||
    row.display_name?.split(",")[0] ||
    null
  );
}

function isStreetRow(row) {
  const klass = String(row.class || "").toLowerCase();
  const type = String(row.type || "").toLowerCase();
  if (klass === "highway") return true;
  if (extractStreetName(row)) return true;
  return ["residential", "tertiary", "secondary", "primary", "trunk", "unclassified"].includes(type);
}

function scoreStreetRow(row, query, pinLat, pinLng) {
  const streetName = extractStreetName(row);
  if (!streetName) return 0;
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  let score = tokenOverlap(query, streetName) * 0.5;
  if (normalize(streetName) === normalize(query)) score += 0.4;
  else if (
    normalize(streetName).includes(normalize(query)) ||
    normalize(query).includes(normalize(streetName))
  ) {
    score += 0.25;
  }
  if (
    Number.isFinite(pinLat) &&
    Number.isFinite(pinLng) &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    const dist = haversineM(pinLat, pinLng, lat, lng);
    if (dist <= 500) score += 0.35;
    else if (dist <= 2000) score += 0.2;
    else if (dist <= 5000) score += 0.05;
    else score -= 0.1;
  }
  if (isStreetRow(row)) score += 0.1;
  return Math.min(1, Math.max(0, score));
}

function validateStreet(parsed) {
  const confidence = Math.max(
    0,
    Math.min(1, Number(parsed?.confidence) || 0.5)
  );
  const streetName = String(parsed?.streetName || "").trim();
  if (!parsed?.ok || !streetName) {
    return { ok: false, reason: "street_not_ok", confidence };
  }
  return { ok: true, confidence };
}

export async function resolveStreetWithLlm(
  text,
  { apiKey, model, strongModel, daerah, fetchImpl } = {}
) {
  const raw = String(text || "").trim();
  if (!raw) {
    return {
      ok: false,
      streetName: "",
      searchQueries: [],
      confidence: 0,
      method: "empty",
    };
  }
  const daerahName = daerah ? daerahLabel(daerah) : "Penang";
  if (!apiKey) {
    return {
      ok: true,
      streetName: raw,
      searchQueries: [`${raw} ${daerahName} Penang`, `${raw} Penang Malaysia`],
      confidence: 0.3,
      method: "raw_fallback",
    };
  }

  const result = await completeWithFailover({
    task: "street",
    apiKey,
    primaryModel: model,
    strongModel,
    fetchImpl,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Daerah: ${daerahName}\nStreet input: ${raw.slice(0, 300)}`,
      },
    ],
    validate: validateStreet,
  });

  if (!result.parsed) {
    return {
      ok: true,
      streetName: raw,
      searchQueries: [`${raw} ${daerahName} Penang`],
      confidence: 0.3,
      method: result.switchReason || "llm_fallback",
      modelUsed: result.modelUsed,
      switched: result.switched,
    };
  }

  const queries = [];
  if (Array.isArray(result.parsed.searchQueries)) {
    for (const q of result.parsed.searchQueries) {
      queries.push(String(q || "").trim());
    }
  }
  const streetName = String(
    result.parsed.streetName || result.parsed.searchQueries?.[0] || raw
  ).trim();
  if (streetName) queries.unshift(streetName);
  const unique = [...new Set(queries.filter(Boolean))];
  if (!result.parsed.ok || !unique.length) {
    return {
      ok: false,
      streetName: "",
      searchQueries: [],
      confidence: result.confidence || 0,
      method: "llm",
      modelUsed: result.modelUsed,
      switched: result.switched,
    };
  }
  return {
    ok: true,
    streetName,
    searchQueries: unique,
    confidence: result.confidence || 0.5,
    method: "llm",
    modelUsed: result.modelUsed,
    switched: result.switched,
    switchReason: result.switchReason,
  };
}

export async function searchStreetCandidates(
  queries,
  { lat, lng, userAgent, fetchImpl } = {}
) {
  const seen = new Set();
  const candidates = [];
  for (const q of queries || []) {
    const key = normalize(q);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const rows = await searchGeocodeRows(q, { userAgent, fetchImpl, limit: 10 });
    for (const row of rows) {
      const streetName = extractStreetName(row);
      if (!streetName) continue;
      const score = scoreStreetRow(row, q, lat, lng);
      if (score < 0.25) continue;
      const dupKey = normalize(streetName);
      if (candidates.some((c) => normalize(c.streetName) === dupKey)) continue;
      candidates.push({
        streetName,
        lat: Number(row.lat),
        lng: Number(row.lon),
        display_name: row.display_name || streetName,
        score,
        query: q,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Resolve a user-typed street name near a pin.
 * @returns {{ best, alternatives, confidence, method, userRaw }}
 */
export async function resolveStreetName(
  userInput,
  { lat, lng, daerah, apiKey, model, strongModel, userAgent, fetchImpl } = {}
) {
  const userRaw = String(userInput || "").trim();
  if (!userRaw) {
    return {
      best: null,
      alternatives: [],
      confidence: 0,
      method: "empty",
      userRaw,
    };
  }

  try {
    const dbHits = await matchStreetDb(userRaw, { lat, lng, daerah, limit: 3 });
    if (dbHits.length && dbHits[0].score >= 0.85) {
      return {
        best: dbHits[0],
        alternatives: dbHits.slice(1),
        confidence: dbHits[0].score,
        method: "street_db",
        userRaw,
      };
    }
  } catch {
    // continue
  }

  const llm = await resolveStreetWithLlm(userRaw, {
    apiKey,
    model,
    strongModel,
    daerah,
    fetchImpl,
  });
  const queries = [
    ...(llm.searchQueries || []),
    userRaw,
    `${userRaw} Penang`,
    llm.streetName ? `${llm.streetName} Penang` : null,
  ].filter(Boolean);

  const candidates = await searchStreetCandidates(queries, {
    lat,
    lng,
    userAgent,
    fetchImpl,
  });

  try {
    const dbHits = await matchStreetDb(userRaw, { lat, lng, daerah, limit: 3 });
    for (const hit of dbHits) {
      if (
        !candidates.some(
          (c) => normalize(c.streetName) === normalize(hit.streetName)
        )
      ) {
        candidates.push(hit);
      }
    }
    candidates.sort((a, b) => b.score - a.score);
  } catch {
    // ignore
  }

  if (!candidates.length) {
    return {
      best: null,
      alternatives: [],
      confidence: 0,
      method: "no_match",
      userRaw,
    };
  }

  const best = candidates[0];
  return {
    best,
    alternatives: candidates.slice(1, 4),
    confidence: best.score,
    method:
      best.method === "street_db"
        ? "street_db"
        : llm.method === "llm"
          ? "ai_verified"
          : llm.method,
    userRaw,
    modelUsed: llm.modelUsed,
    switched: llm.switched,
  };
}
