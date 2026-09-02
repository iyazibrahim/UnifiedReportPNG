/**
 * Verify and resolve street names via LLM normalization + Nominatim search near pin.
 */
import { daerahLabel } from "../jurisdiction/daerah.js";
import { searchGeocodeRows } from "./geocode.js";

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
  else if (normalize(streetName).includes(normalize(query)) || normalize(query).includes(normalize(streetName))) {
    score += 0.25;
  }
  if (Number.isFinite(pinLat) && Number.isFinite(pinLng) && Number.isFinite(lat) && Number.isFinite(lng)) {
    const dist = haversineM(pinLat, pinLng, lat, lng);
    if (dist <= 500) score += 0.35;
    else if (dist <= 2000) score += 0.2;
    else if (dist <= 5000) score += 0.05;
    else score -= 0.1;
  }
  if (isStreetRow(row)) score += 0.1;
  return Math.min(1, Math.max(0, score));
}

export async function resolveStreetWithLlm(
  text,
  { apiKey, model, daerah, fetchImpl } = {}
) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { ok: false, streetName: "", searchQueries: [], confidence: 0, method: "empty" };
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
  const fetchFn = fetchImpl || fetch;
  try {
    const res = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "openai/gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Daerah: ${daerahName}\nStreet input: ${raw.slice(0, 300)}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: true,
        streetName: raw,
        searchQueries: [`${raw} ${daerahName} Penang`],
        confidence: 0.3,
        method: "llm_http_fallback",
      };
    }
    const body = await res.json();
    const content = body.choices?.[0]?.message?.content || "";
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      return {
        ok: true,
        streetName: raw,
        searchQueries: [`${raw} Penang Malaysia`],
        confidence: 0.3,
        method: "llm_parse_fallback",
      };
    }
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    const queries = [];
    if (Array.isArray(parsed.searchQueries)) {
      for (const q of parsed.searchQueries) queries.push(String(q || "").trim());
    }
    const streetName = String(parsed.streetName || parsed.searchQueries?.[0] || raw).trim();
    if (streetName) queries.unshift(streetName);
    const unique = [...new Set(queries.filter(Boolean))];
    if (!parsed.ok || !unique.length) {
      return {
        ok: false,
        streetName: "",
        searchQueries: [],
        confidence: Number(parsed.confidence) || 0,
        method: "llm",
      };
    }
    return {
      ok: true,
      streetName,
      searchQueries: unique,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      method: "llm",
    };
  } catch {
    return {
      ok: true,
      streetName: raw,
      searchQueries: [`${raw} Penang Malaysia`],
      confidence: 0.3,
      method: "llm_error_fallback",
    };
  }
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
  { lat, lng, daerah, apiKey, model, userAgent, fetchImpl } = {}
) {
  const userRaw = String(userInput || "").trim();
  if (!userRaw) {
    return { best: null, alternatives: [], confidence: 0, method: "empty", userRaw };
  }

  const llm = await resolveStreetWithLlm(userRaw, {
    apiKey,
    model,
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
  const confidence = Math.max(best.score, llm.confidence || 0);
  return {
    best,
    alternatives: candidates.slice(0, 3),
    confidence,
    method: llm.method === "llm" ? "ai_verified" : "nominatim",
    userRaw,
  };
}
