/**
 * Normalize a colloquial Penang landmark into Nominatim search queries via OpenRouter,
 * then fall back to heuristic stripping (depan / berdekatan / traffic light / …).
 */
import { buildLandmarkQueries } from "./landmarkQueries.js";
import { forwardGeocodeCandidates } from "./geocode.js";

const SYSTEM = `You help locate citizen reports in Pulau Pinang (Penang), Malaysia only.
Given a landmark or place phrase in Malay/English slang, return JSON only:
{"ok":true,"searchQuery":"<Nominatim-friendly place name>","searchQueries":["..."],"areaHint":"pulau"|"seberang"|"unknown","confidence":0.0}
Rules:
- Extract the ANCHOR place only. Drop relative words: depan, hadapan, berdekatan, dekat, tepi, traffic/traffik light, lampu isyarat, nearby, in front of.
- If the user wrote A / B, include both anchors as separate searchQueries.
- searchQuery must be a real named place + locality (George Town / Butterworth / Kepala Batas / Balik Pulau / Seberang Perai / Penang).
- Do NOT put "traffic light" or "junction" in the query unless that is the official POI name.
- Examples:
  "traffik light berdekatan lotus kepala batas / bertam" → searchQueries: ["Lotus Kepala Batas Penang","Lotus Bertam Penang"]
  "depan masjid jamek sungai rusa" → searchQueries: ["Masjid Jamek Sungai Rusa Penang"]
  "Padang Kota" → "Padang Kota Lama Esplanade George Town Penang"
  "Jetty Butterworth" → "Butterworth Ferry Terminal Penang"
- If clearly outside Penang or nonsense: {"ok":false,"searchQuery":"","searchQueries":[],"areaHint":"unknown","confidence":0}
- Never invent latitude or longitude.`;

function llmQueriesFromParsed(parsed) {
  const list = [];
  if (Array.isArray(parsed.searchQueries)) {
    for (const q of parsed.searchQueries) list.push(String(q || "").trim());
  }
  if (parsed.searchQuery) list.push(String(parsed.searchQuery).trim());
  return list.filter(Boolean);
}

export async function resolveLandmarkWithLlm(text, { apiKey, model, fetchImpl } = {}) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { ok: false, searchQuery: "", searchQueries: [], areaHint: "unknown", confidence: 0, method: "empty" };
  }
  if (!apiKey) {
    return {
      ok: true,
      searchQuery: `${raw} Penang Malaysia`,
      searchQueries: [`${raw} Penang Malaysia`],
      areaHint: "unknown",
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
          { role: "user", content: raw.slice(0, 500) },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: true,
        searchQuery: `${raw} Penang Malaysia`,
        searchQueries: [`${raw} Penang Malaysia`],
        areaHint: "unknown",
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
        searchQuery: `${raw} Penang Malaysia`,
        searchQueries: [`${raw} Penang Malaysia`],
        areaHint: "unknown",
        confidence: 0.3,
        method: "llm_parse_fallback",
      };
    }
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    const searchQueries = llmQueriesFromParsed(parsed);
    const ok = Boolean(parsed.ok) && searchQueries.length > 0;
    if (!ok) {
      return {
        ok: false,
        searchQuery: "",
        searchQueries: [],
        areaHint: "unknown",
        confidence: Number(parsed.confidence) || 0,
        method: "llm",
      };
    }
    const hint = ["pulau", "seberang"].includes(parsed.areaHint)
      ? parsed.areaHint
      : "unknown";
    return {
      ok: true,
      searchQuery: searchQueries[0],
      searchQueries,
      areaHint: hint,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      method: "llm",
    };
  } catch {
    return {
      ok: true,
      searchQuery: `${raw} Penang Malaysia`,
      searchQueries: [`${raw} Penang Malaysia`],
      areaHint: "unknown",
      confidence: 0.3,
      method: "llm_error_fallback",
    };
  }
}

/**
 * LLM (optional) + heuristic query stripping, then Nominatim until a hit.
 */
export async function resolveCitizenPlace(
  text,
  { apiKey, model, userAgent, fetchImpl } = {}
) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const resolved = await resolveLandmarkWithLlm(raw, { apiKey, model, fetchImpl });
  const queries = buildLandmarkQueries(raw, resolved.searchQueries || []);
  const hit = await forwardGeocodeCandidates(queries, { userAgent, fetchImpl });
  if (!hit) return null;
  return {
    ...hit,
    method: resolved.method,
    queriesTried: queries,
  };
}
