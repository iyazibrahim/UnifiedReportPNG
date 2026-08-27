/** Build Nominatim-friendly queries from colloquial Malay/English landmark text. */

const RELATIVE_PHRASES = [
  /\btraffik\s+lights?\b/gi,
  /\btraffic\s+lights?\b/gi,
  /\blampu\s+isyarat\b/gi,
  /\blampu\s+trafik\b/gi,
  /\blampu\s+traffik\b/gi,
  /\bin\s+front\s+of\b/gi,
  /\bnext\s+to\b/gi,
  /\bbersebelahan\b/gi,
  /\bberdekatan\b/gi,
  /\bsebelah\b/gi,
  /\bhadapan\b/gi,
  /\bbelakang\b/gi,
  /\bnearby\b/gi,
  /\bdepan\b/gi,
  /\bdekat\b/gi,
  /\btepi\b/gi,
  /\bnear\b/gi,
  /\bat\b/gi,
  /\bdi\b/gi,
];

const SPLIT = /\s*(?:\/|,|;|\batau\b|\bdan\b|\band\b)\s*/i;

function collapse(text) {
  return String(text || "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripRelativePhrases(text) {
  let t = collapse(text);
  for (const re of RELATIVE_PHRASES) {
    t = t.replace(re, " ");
  }
  return collapse(t);
}

function pushQuery(list, q) {
  const s = collapse(q);
  if (s.length < 3) return;
  const key = s.toLowerCase();
  if (list.some((x) => x.toLowerCase() === key)) return;
  list.push(s);
}

/**
 * Ordered unique search strings. Heuristic queries first (Nominatim-friendly),
 * then optional LLM suggestions.
 */
export function buildLandmarkQueries(raw, llmQueries = []) {
  const queries = [];
  const stripped = collapse(
    stripRelativePhrases(raw).replace(/[\/|,;]/g, " ")
  );
  const parts = String(raw || "")
    .split(SPLIT)
    .map((p) => stripRelativePhrases(p))
    .filter((p) => p.length >= 3);

  pushQuery(queries, stripped);
  pushQuery(queries, `${stripped} Penang`);
  pushQuery(queries, `${stripped} Pulau Pinang Malaysia`);

  for (const p of parts) {
    pushQuery(queries, p);
    pushQuery(queries, `${p} Penang`);
    pushQuery(queries, `${p} Pulau Pinang`);
  }

  const tokens = stripped.split(" ").filter(Boolean);
  if (tokens.length > 4) {
    pushQuery(queries, `${tokens.slice(-4).join(" ")} Penang`);
  }
  if (tokens.length > 3) {
    pushQuery(queries, `${tokens.slice(-3).join(" ")} Penang`);
  }

  for (const q of llmQueries) {
    pushQuery(queries, q);
    const cleaned = stripRelativePhrases(q);
    pushQuery(queries, cleaned);
    pushQuery(queries, `${cleaned} Penang`);
  }

  return queries.slice(0, 8);
}
