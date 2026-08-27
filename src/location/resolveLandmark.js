/**
 * Normalize a colloquial Penang landmark into a Nominatim search query via OpenRouter.
 * Does not invent lat/lng — only a searchable query string.
 */
const SYSTEM = `You help locate citizen reports in Pulau Pinang (Penang), Malaysia only.
Given a landmark or place phrase in Malay/English slang, return JSON only:
{"ok":true,"searchQuery":"<English or Malay place name suitable for OpenStreetMap Nominatim>","areaHint":"pulau"|"seberang"|"unknown","confidence":0.0}
Rules:
- searchQuery must be concrete and searchable (add George Town / Butterworth / Seberang Perai / Penang as needed).
- Examples: "Padang Kota" → "Padang Kota Lama Esplanade George Town Penang"; "Jetty Butterworth" → "Butterworth Ferry Terminal Penang"; "TM Butterworth" → "Telekom Malaysia Butterworth Penang".
- If outside Penang or nonsense: {"ok":false,"searchQuery":"","areaHint":"unknown","confidence":0}
- Never invent latitude or longitude.`;

export async function resolveLandmarkWithLlm(text, { apiKey, model, fetchImpl } = {}) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { ok: false, searchQuery: "", areaHint: "unknown", confidence: 0, method: "empty" };
  }
  if (!apiKey) {
    return {
      ok: true,
      searchQuery: `${raw} Penang Malaysia`,
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
        areaHint: "unknown",
        confidence: 0.3,
        method: "llm_parse_fallback",
      };
    }
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    const ok = Boolean(parsed.ok);
    const searchQuery = String(parsed.searchQuery || "").trim();
    if (!ok || !searchQuery) {
      return {
        ok: false,
        searchQuery: "",
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
      searchQuery,
      areaHint: hint,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      method: "llm",
    };
  } catch {
    return {
      ok: true,
      searchQuery: `${raw} Penang Malaysia`,
      areaHint: "unknown",
      confidence: 0.3,
      method: "llm_error_fallback",
    };
  }
}
