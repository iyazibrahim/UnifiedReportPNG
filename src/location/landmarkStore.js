import mongoose from "mongoose";
import { Landmark } from "../models/Landmark.js";
import {
  matchLandmarkList,
  matchLandmarkListTopN,
  landmarkToPlaceHit,
} from "./matchLandmark.js";
import { daerahMatchesLocality } from "./localityHints.js";

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

export function invalidateLandmarkCache() {
  cache = null;
  cacheAt = 0;
}

export async function loadLandmarksCached({ force = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return cache || [];
  }
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) return cache;
  try {
    cache = await Landmark.find({ disabled: { $ne: true } }).lean();
    cacheAt = now;
    return cache;
  } catch {
    return cache || [];
  }
}

function filterByLocality(list, { locality, daerahHint } = {}) {
  if (!locality && !daerahHint) return list;
  return (list || []).filter((lm) =>
    daerahMatchesLocality(lm.daerah, locality, daerahHint)
  );
}

export async function matchLandmarkDb(
  query,
  { minScore = 0.72, locality = null, daerahHint = null } = {}
) {
  const list = await loadLandmarksCached();
  if (!list.length) return null;
  const scoped = filterByLocality(list, { locality, daerahHint });
  const pool = scoped.length ? scoped : list;
  const hit = matchLandmarkList(query, pool, { minScore });
  if (!hit) return null;
  return landmarkToPlaceHit(
    { ...hit.landmark, score: hit.score },
    "landmark_db"
  );
}

export async function matchLandmarkDbTopN(
  query,
  { minScore = 0.72, locality = null, daerahHint = null, limit = 3 } = {}
) {
  const list = await loadLandmarksCached();
  if (!list.length) return [];
  const scoped = filterByLocality(list, { locality, daerahHint });
  const pool = scoped.length ? scoped : list;
  return matchLandmarkListTopN(query, pool, { minScore, limit }).map((hit) =>
    landmarkToPlaceHit({ ...hit.landmark, score: hit.score }, "landmark_db")
  );
}
