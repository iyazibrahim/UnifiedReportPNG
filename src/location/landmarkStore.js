import mongoose from "mongoose";
import { Landmark } from "../models/Landmark.js";
import { matchLandmarkList, landmarkToPlaceHit } from "./matchLandmark.js";

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

export async function loadLandmarksCached({ force = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return cache || [];
  }
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) return cache;
  try {
    cache = await Landmark.find({}).lean();
    cacheAt = now;
    return cache;
  } catch {
    return cache || [];
  }
}

export async function matchLandmarkDb(query, { minScore = 0.72 } = {}) {
  const list = await loadLandmarksCached();
  if (!list.length) return null;
  const hit = matchLandmarkList(query, list, { minScore });
  if (!hit) return null;
  return landmarkToPlaceHit(
    { ...hit.landmark, score: hit.score },
    "landmark_db"
  );
}
