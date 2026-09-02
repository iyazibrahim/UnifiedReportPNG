/**
 * Parse LLM anchor extraction response into structured POI + locality fields.
 */
export function parseAnchorFromLlm(parsed) {
  const poiName = String(parsed.poiName || "").trim();
  const locality = String(parsed.locality || "").trim();
  const list = [];
  if (Array.isArray(parsed.searchQueries)) {
    for (const q of parsed.searchQueries) list.push(String(q || "").trim());
  }
  if (parsed.searchQuery) list.push(String(parsed.searchQuery).trim());
  const searchQueries = list.filter(Boolean);
  const hint = ["pulau", "seberang"].includes(parsed.areaHint)
    ? parsed.areaHint
    : "unknown";
  return {
    poiName,
    locality,
    searchQueries,
    areaHint: hint,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
  };
}

/**
 * Build DB search queries from anchor extraction.
 */
export function buildDbSearchQueries(raw, anchor) {
  const queries = [];
  const push = (q) => {
    const s = String(q || "").trim();
    if (s.length >= 2 && !queries.includes(s)) queries.push(s);
  };
  if (anchor.poiName) {
    push(anchor.poiName);
    if (anchor.locality) push(`${anchor.poiName} ${anchor.locality}`);
  }
  push(raw);
  return queries;
}
