import { stripRelativePhrases } from "./landmarkQueries.js";
import { daerahLabel } from "../jurisdiction/daerah.js";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  return normalize(text).split(" ").filter((t) => t.length > 1);
}

/** Score how well query matches a landmark name/aliases (0–1). */
export function scoreLandmarkMatch(query, landmark) {
  const q = normalize(stripRelativePhrases(query));
  if (!q) return 0;
  const names = [landmark.name, ...(landmark.aliases || [])].map(normalize);
  let best = 0;
  for (const name of names) {
    if (!name) continue;
    if (q === name) best = Math.max(best, 1);
    else if (name.includes(q) || q.includes(name)) best = Math.max(best, 0.92);
    else {
      const qt = tokens(q);
      const nt = new Set(tokens(name));
      if (!qt.length) continue;
      const hit = qt.filter((t) => nt.has(t)).length;
      const overlap = hit / qt.length;
      if (overlap >= 0.6) best = Math.max(best, 0.55 + overlap * 0.4);
    }
  }
  return best;
}

/**
 * Fuzzy match against an in-memory list (used by tests + after Mongo load).
 * @returns {{ landmark, score } | null}
 */
export function matchLandmarkList(query, landmarks, { minScore = 0.72 } = {}) {
  const parts = String(query || "")
    .split(/\s*(?:\/|,|;|\batau\b|\bdan\b)\s*/i)
    .map((p) => stripRelativePhrases(p))
    .filter(Boolean);
  const candidates = parts.length ? parts : [stripRelativePhrases(query)];

  let best = null;
  for (const part of candidates) {
    for (const lm of landmarks || []) {
      const score = scoreLandmarkMatch(part, lm);
      if (score >= minScore && (!best || score > best.score)) {
        best = { landmark: lm, score, matchedQuery: part };
      }
    }
  }
  return best;
}

export function landmarkToPlaceHit(landmark, method = "landmark_db") {
  const daerah = landmark.daerah || "unknown";
  const display =
    landmark.address ||
    `${landmark.name}, ${daerahLabel(daerah)}, Pulau Pinang`;
  return {
    lat: Number(landmark.lat),
    lng: Number(landmark.lng),
    display_name: display,
    road: null,
    suburb: null,
    city: daerahLabel(daerah),
    postcode: null,
    daerah,
    side: landmark.side || null,
    placeName: landmark.name,
    category: landmark.category,
    method,
    score: landmark.score,
    raw: landmark,
  };
}
