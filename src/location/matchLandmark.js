import { stripRelativePhrases } from "./landmarkQueries.js";
import { daerahLabel } from "../jurisdiction/daerah.js";
import { splitPoiAndLocality } from "./localityHints.js";

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

function extraPoiTokens(query, matchedName) {
  const qt = new Set(tokens(query));
  for (const t of tokens(matchedName)) qt.delete(t);
  const { locality } = splitPoiAndLocality(query);
  if (locality) {
    for (const t of tokens(locality)) qt.delete(t);
  }
  return [...qt];
}

/** Score how well query matches a landmark name/aliases (0–1). */
export function scoreLandmarkMatch(query, landmark) {
  const q = normalize(stripRelativePhrases(query));
  if (!q) return 0;
  const names = [landmark.name, ...(landmark.aliases || [])].map(normalize);
  let best = 0;
  for (const name of names) {
    if (!name) continue;
    if (q === name) {
      best = Math.max(best, 1);
      continue;
    }
    if (name.includes(q)) {
      best = Math.max(best, 0.92);
      continue;
    }
    if (q.includes(name)) {
      const extra = extraPoiTokens(q, name);
      if (extra.length === 0) {
        best = Math.max(best, 0.92);
      } else {
        // Query has POI tokens beyond locality alias — penalize locality-only hit
        best = Math.max(best, 0.45);
      }
      continue;
    }
    const qt = tokens(q);
    const nt = new Set(tokens(name));
    if (!qt.length) continue;
    const hit = qt.filter((t) => nt.has(t)).length;
    const overlap = hit / qt.length;
    if (overlap >= 0.6) best = Math.max(best, 0.55 + overlap * 0.4);
  }
  return best;
}

function collectMatches(query, landmarks, { minScore = 0.72 } = {}) {
  const parts = String(query || "")
    .split(/\s*(?:\/|,|;|\batau\b|\bdan\b)\s*/i)
    .map((p) => stripRelativePhrases(p))
    .filter(Boolean);
  const candidates = parts.length ? parts : [stripRelativePhrases(query)];

  const hits = [];
  for (const part of candidates) {
    for (const lm of landmarks || []) {
      const score = scoreLandmarkMatch(part, lm);
      if (score >= minScore) {
        hits.push({ landmark: lm, score, matchedQuery: part });
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

/**
 * Fuzzy match against an in-memory list (used by tests + after Mongo load).
 * @returns {{ landmark, score, matchedQuery } | null}
 */
export function matchLandmarkList(query, landmarks, { minScore = 0.72 } = {}) {
  const hits = collectMatches(query, landmarks, { minScore });
  return hits[0] || null;
}

/**
 * Return top-N landmark matches for disambiguation.
 * @returns {Array<{ landmark, score, matchedQuery }>}
 */
export function matchLandmarkListTopN(
  query,
  landmarks,
  { minScore = 0.72, limit = 3 } = {}
) {
  const hits = collectMatches(query, landmarks, { minScore });
  const seen = new Set();
  const unique = [];
  for (const hit of hits) {
    const key = `${hit.landmark.name}|${hit.landmark.lat}|${hit.landmark.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
    if (unique.length >= limit) break;
  }
  return unique;
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
    landmarkId: landmark._id ? String(landmark._id) : null,
    raw: landmark,
  };
}
