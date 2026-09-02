/**
 * Normalize a colloquial Penang landmark into Nominatim search queries via OpenRouter,
 * then fall back to heuristic stripping (depan / berdekatan / traffic light / …).
 * LLM anchor extraction runs first; local Landmark DB is searched on POI name.
 */
import { buildLandmarkQueries } from "./landmarkQueries.js";
import { forwardGeocodeCandidates } from "./geocode.js";
import { matchLandmarkDb, matchLandmarkDbTopN } from "./landmarkStore.js";
import { locateDaerah, daerahLabel } from "../jurisdiction/daerah.js";
import { splitPoiAndLocality } from "./localityHints.js";
import {
  parseAnchorFromLlm,
  buildDbSearchQueries,
} from "./extractPlaceAnchor.js";

const SYSTEM = `You help locate citizen reports in Pulau Pinang (Penang), Malaysia only.
Given a landmark or place phrase in Malay/English slang, return JSON only:
{"ok":true,"poiName":"<shop/building/POI name only, empty if user only named a town>","locality":"<area e.g. Balik Pulau, Kepala Batas, George Town>","searchQuery":"<Nominatim-friendly place name>","searchQueries":["..."],"areaHint":"pulau"|"seberang"|"unknown","confidence":0.0}
Rules:
- poiName = the named POI/shop/building ONLY (e.g. "TF Mart", "Lotus", "Masjid Jamek Sungai Rusa"). Never put just the town name in poiName.
- locality = area/daerah hint for disambiguation (e.g. "Balik Pulau", "Kepala Batas"). Empty if unknown.
- Extract the ANCHOR place only. Drop relative words: depan, hadapan, berdekatan, dekat, tepi, traffic/traffik light, lampu isyarat, nearby, in front of.
- If the user wrote A / B, include both anchors as separate searchQueries.
- searchQuery must be a real named place + locality (George Town / Butterworth / Kepala Batas / Balik Pulau / Seberang Perai / Penang).
- Do NOT put "traffic light" or "junction" in the query unless that is the official POI name.
- Examples:
  "TF Mart Balik Pulau" → poiName:"TF Mart", locality:"Balik Pulau", searchQueries:["TF Mart Balik Pulau Penang","TF Value Mart Balik Pulau Penang"]
  "traffik light berdekatan lotus kepala batas / bertam" → poiName:"Lotus", locality:"Kepala Batas", searchQueries:["Lotus Kepala Batas Penang","Lotus Bertam Penang"]
  "depan masjid jamek sungai rusa" → poiName:"Masjid Jamek Sungai Rusa", locality:"Sungai Rusa", searchQueries:["Masjid Jamek Sungai Rusa Penang"]
  "Balik Pulau" → poiName:"", locality:"Balik Pulau", searchQueries:["Balik Pulau Penang"]
  "Padang Kota" → poiName:"Padang Kota Lama", locality:"George Town", searchQueries:["Padang Kota Lama Esplanade George Town Penang"]
  "Jetty Butterworth" → poiName:"Butterworth Ferry Terminal", locality:"Butterworth", searchQueries:["Butterworth Ferry Terminal Penang"]
- If clearly outside Penang or nonsense: {"ok":false,"poiName":"","locality":"","searchQuery":"","searchQueries":[],"areaHint":"unknown","confidence":0}
- Never invent latitude or longitude.`;

function llmQueriesFromParsed(parsed) {
  const anchor = parseAnchorFromLlm(parsed);
  return anchor.searchQueries;
}

function heuristicAnchor(raw) {
  const split = splitPoiAndLocality(raw);
  return {
    poiName: split.poiText,
    locality: split.locality,
    searchQueries: [`${raw} Penang Malaysia`],
    areaHint: split.daerahHint
      ? split.daerahHint.startsWith("sp")
        ? "seberang"
        : "pulau"
      : "unknown",
    confidence: 0.3,
    method: "raw_fallback",
  };
}

export async function resolveLandmarkWithLlm(text, { apiKey, model, fetchImpl } = {}) {
  const raw = String(text || "").trim();
  if (!raw) {
    return {
      ok: false,
      poiName: "",
      locality: "",
      searchQuery: "",
      searchQueries: [],
      areaHint: "unknown",
      confidence: 0,
      method: "empty",
    };
  }
  if (!apiKey) {
    const anchor = heuristicAnchor(raw);
    return { ok: true, ...anchor, searchQuery: anchor.searchQueries[0] };
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
          { role: "user", content: raw.slice(0, 500) },
        ],
      }),
    });
    if (!res.ok) {
      const anchor = heuristicAnchor(raw);
      return {
        ok: true,
        ...anchor,
        searchQuery: anchor.searchQueries[0],
        method: "llm_http_fallback",
      };
    }
    const body = await res.json();
    const content = body.choices?.[0]?.message?.content || "";
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      const anchor = heuristicAnchor(raw);
      return {
        ok: true,
        ...anchor,
        searchQuery: anchor.searchQueries[0],
        method: "llm_parse_fallback",
      };
    }
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    const anchor = parseAnchorFromLlm(parsed);
    const searchQueries = anchor.searchQueries;
    const ok = Boolean(parsed.ok) && searchQueries.length > 0;
    if (!ok) {
      return {
        ok: false,
        poiName: anchor.poiName,
        locality: anchor.locality,
        searchQuery: "",
        searchQueries: [],
        areaHint: anchor.areaHint,
        confidence: anchor.confidence,
        method: "llm",
      };
    }
    return {
      ok: true,
      poiName: anchor.poiName,
      locality: anchor.locality,
      searchQuery: searchQueries[0],
      searchQueries,
      areaHint: anchor.areaHint,
      confidence: anchor.confidence,
      method: "llm",
    };
  } catch {
    const anchor = heuristicAnchor(raw);
    return {
      ok: true,
      ...anchor,
      searchQuery: anchor.searchQueries[0],
      method: "llm_error_fallback",
    };
  }
}

function attachDaerah(hit, method) {
  if (!hit) return null;
  const daerah = hit.daerah || locateDaerah(hit.lat, hit.lng);
  const label = daerahLabel(daerah);
  let display_name = hit.display_name;
  if (hit.placeName) {
    display_name = `${hit.placeName} · ${label} · Pulau Pinang`;
  } else if (
    display_name &&
    !/Timur Laut|Barat Daya|Seberang Perai/i.test(display_name)
  ) {
    display_name = `${display_name} (${label})`;
  }
  return {
    ...hit,
    daerah,
    city: label,
    display_name,
    method: method || hit.method,
  };
}

function isAdministrativeHit(hit) {
  const raw = hit?.raw?.raw || hit?.raw || {};
  const type = String(raw.type || "").toLowerCase();
  const klass = String(raw.class || "").toLowerCase();
  return (
    type === "administrative" ||
    (klass === "place" && ["city", "town", "village", "suburb"].includes(type))
  );
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

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = `${c.lat?.toFixed(5)}|${c.lng?.toFixed(5)}|${c.placeName || c.display_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function assessDisambiguation(candidates, { poiName, nominatimHit }) {
  if (candidates.length > 1) {
    const [a, b] = candidates;
    if (
      haversineM(a.lat, a.lng, b.lat, b.lng) < 2000 &&
      Math.abs((a.score || 0) - (b.score || 0)) < 0.15
    ) {
      return true;
    }
  }
  const best = candidates[0];
  if (!best) return false;
  if ((best.score || 0) < 0.85 && poiName) return true;
  if (nominatimHit && isAdministrativeHit(nominatimHit) && poiName) return true;
  return false;
}

async function searchLandmarkDb(raw, anchor, { skipDb }) {
  if (skipDb) return [];
  try {
    const split = splitPoiAndLocality(raw);
    const locality = anchor.locality || split.locality;
    const daerahHint = split.daerahHint;
    const queries = buildDbSearchQueries(raw, anchor);
    const hits = [];
    for (const q of queries) {
      const batch = await matchLandmarkDbTopN(q, {
        locality,
        daerahHint,
        minScore: 0.72,
        limit: 3,
      });
      hits.push(...batch);
    }
    return dedupeCandidates(hits);
  } catch {
    return [];
  }
}

/**
 * Resolve citizen place with optional disambiguation candidates.
 * @returns {{ best: object|null, candidates: object[], needsDisambiguation: boolean, confidence: number }}
 */
export async function resolveCitizenPlaceWithOptions(
  text,
  { apiKey, model, userAgent, fetchImpl, skipDb = false } = {}
) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { best: null, candidates: [], needsDisambiguation: false, confidence: 0 };
  }

  const resolved = await resolveLandmarkWithLlm(raw, { apiKey, model, fetchImpl });
  const anchor = {
    poiName: resolved.poiName || "",
    locality: resolved.locality || "",
    areaHint: resolved.areaHint || "unknown",
    confidence: resolved.confidence || 0.3,
  };

  const dbHits = await searchLandmarkDb(raw, anchor, { skipDb });
  const dbCandidates = dbHits.map((h) =>
    attachDaerah({ ...h, score: h.score ?? 1 }, "landmark_db")
  );

  let nominatimHit = null;
  const queries = buildLandmarkQueries(raw, resolved.searchQueries || []);
  nominatimHit = await forwardGeocodeCandidates(queries, {
    userAgent,
    fetchImpl,
    queryContext: raw,
  });
  const method =
    resolved.method === "llm" ? "landmark_ai" : "text_geocode";
  const geoCandidate = nominatimHit
    ? attachDaerah(
        {
          ...nominatimHit,
          method,
          score: anchor.confidence,
          queriesTried: queries,
        },
        method
      )
    : null;

  const all = dedupeCandidates([...dbCandidates, ...(geoCandidate ? [geoCandidate] : [])]);
  if (!all.length) {
    return { best: null, candidates: [], needsDisambiguation: false, confidence: 0 };
  }

  all.sort((a, b) => (b.score || 0) - (a.score || 0));
  const needsDisambiguation = assessDisambiguation(all, {
    poiName: anchor.poiName,
    nominatimHit: geoCandidate,
  });

  return {
    best: all[0],
    candidates: all.slice(0, 3),
    needsDisambiguation,
    confidence: all[0].score ?? anchor.confidence,
  };
}

/**
 * Local Landmark DB → LLM + Nominatim heuristics.
 */
export async function resolveCitizenPlace(
  text,
  { apiKey, model, userAgent, fetchImpl, skipDb = false } = {}
) {
  const result = await resolveCitizenPlaceWithOptions(text, {
    apiKey,
    model,
    userAgent,
    fetchImpl,
    skipDb,
  });
  if (result.needsDisambiguation && result.candidates.length > 1) {
    return { ...result.best, disambiguationCandidates: result.candidates };
  }
  return result.best;
}
