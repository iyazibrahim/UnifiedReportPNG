/**
 * Seed Penang landmarks into Mongo from curated JSON + optional OSM / Google Places.
 *
 * Usage:
 *   node scripts/seed-landmarks.js
 *   node scripts/seed-landmarks.js --from-file-only
 *   GOOGLE_PLACES_API_KEY=... node scripts/seed-landmarks.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "../src/db.js";
import { Landmark } from "../src/models/Landmark.js";
import { locateDaerah } from "../src/jurisdiction/daerah.js";
import { locateRegion } from "../src/jurisdiction/region.js";
import { daerahLabel } from "../src/jurisdiction/daerah.js";
import {
  mapOsmCategory as mapOsmCategoryShared,
  classifyWorshipFromName,
} from "../src/location/landmarkCategory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, "../data/landmarks.seed.json");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const PENANG_BBOX = "5.14,100.15,5.55,100.55"; // south,west,north,east

const fileOnly = process.argv.includes("--from-file-only");
const dryRun = process.argv.includes("--dry-run");

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normalizeName(n) {
  return String(n || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function enrichMeta(row) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const daerah = row.daerah && row.daerah !== "unknown"
    ? row.daerah
    : locateDaerah(lat, lng);
  const side = row.side || locateRegion(lat, lng);
  const address =
    row.address ||
    `${row.name}, ${daerahLabel(daerah)}, Pulau Pinang`;
  return {
    name: row.name,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    category: row.category || "landmark",
    lat,
    lng,
    daerah,
    side: side === "outside" ? "pulau" : side,
    source: row.source || "curated",
    osmId: row.osmId || null,
    googlePlaceId: row.googlePlaceId || null,
    address,
  };
}

function loadSeedFile() {
  const raw = fs.readFileSync(SEED_PATH, "utf8");
  return JSON.parse(raw).map(enrichMeta);
}

function mapOsmCategory(tags = {}) {
  return mapOsmCategoryShared(tags);
}

async function fetchOsmLandmarks(fetchImpl = fetch) {
  const query = `
[out:json][timeout:90];
(
  node["amenity"="place_of_worship"]["name"](${PENANG_BBOX});
  node["amenity"="school"]["name"](${PENANG_BBOX});
  node["amenity"="university"]["name"](${PENANG_BBOX});
  node["amenity"="hospital"]["name"](${PENANG_BBOX});
  node["amenity"="clinic"]["name"](${PENANG_BBOX});
  node["shop"="supermarket"]["name"](${PENANG_BBOX});
  node["shop"="mall"]["name"](${PENANG_BBOX});
  node["shop"="department_store"]["name"](${PENANG_BBOX});
  node["building"="apartments"]["name"](${PENANG_BBOX});
  node["amenity"="ferry_terminal"]["name"](${PENANG_BBOX});
  way["amenity"="place_of_worship"]["name"](${PENANG_BBOX});
  way["amenity"="school"]["name"](${PENANG_BBOX});
  way["amenity"="hospital"]["name"](${PENANG_BBOX});
  way["shop"="supermarket"]["name"](${PENANG_BBOX});
  way["shop"="mall"]["name"](${PENANG_BBOX});
);
out center tags;
`.trim();

  const res = await fetchImpl(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "UnifiedReportPenang/1.0 (seed-landmarks)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  const body = await res.json();
  const rows = [];
  for (const el of body.elements || []) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rows.push(
      enrichMeta({
        name,
        aliases: tags["name:en"] && tags["name:en"] !== name ? [tags["name:en"]] : [],
        category: mapOsmCategory(tags),
        lat,
        lng,
        source: "osm",
        osmId: `${el.type}/${el.id}`,
      })
    );
  }
  return rows;
}

function mapGooglePlaceCategory(type, name = "") {
  if (type === "mosque") return "masjid";
  if (type === "church") return "church";
  if (type === "hindu_temple") return "temple";
  if (type === "place_of_worship") return classifyWorshipFromName(name);
  if (type === "shopping_mall") return "mall";
  if (type === "university") return "school";
  return type;
}

async function fetchGoogleNearby(apiKey, fetchImpl = fetch) {
  const types = [
    "mosque",
    "church",
    "hindu_temple",
    "place_of_worship",
    "school",
    "hospital",
    "supermarket",
    "shopping_mall",
    "university",
  ];
  // Coarse grid over Penang
  const lats = [5.2, 5.3, 5.4, 5.5];
  const lngs = [100.2, 100.3, 100.4, 100.5];
  const rows = [];
  const seen = new Set();

  for (const lat of lats) {
    for (const lng of lngs) {
      for (const type of types) {
        const url = new URL(
          "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        );
        url.searchParams.set("location", `${lat},${lng}`);
        url.searchParams.set("radius", "8000");
        url.searchParams.set("type", type);
        url.searchParams.set("key", apiKey);
        const res = await fetchImpl(url);
        if (!res.ok) continue;
        const body = await res.json();
        for (const p of body.results || []) {
          if (!p.place_id || seen.has(p.place_id)) continue;
          seen.add(p.place_id);
          const plat = p.geometry?.location?.lat;
          const plng = p.geometry?.location?.lng;
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
          rows.push(
            enrichMeta({
              name: p.name,
              aliases: [],
              category: mapGooglePlaceCategory(type, p.name),
              lat: plat,
              lng: plng,
              source: "google",
              googlePlaceId: p.place_id,
              address: p.vicinity || "",
            })
          );
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
  return rows;
}

function mergeLandmarks(lists) {
  const out = [];
  for (const list of lists) {
    for (const row of list) {
      const dup = out.find(
        (x) =>
          (row.osmId && x.osmId === row.osmId) ||
          (row.googlePlaceId && x.googlePlaceId === row.googlePlaceId) ||
          (haversineM(x.lat, x.lng, row.lat, row.lng) < 40 &&
            normalizeName(x.name) === normalizeName(row.name))
      );
      if (dup) {
        const aliases = new Set([
          ...(dup.aliases || []),
          ...(row.aliases || []),
          row.name !== dup.name ? row.name : null,
        ].filter(Boolean));
        dup.aliases = [...aliases];
        if (row.source === "google") dup.googlePlaceId = row.googlePlaceId;
        if (row.source === "osm") dup.osmId = row.osmId;
        if (dup.source !== row.source) dup.source = "merged";
        if (row.address && !dup.address) dup.address = row.address;
      } else {
        out.push({ ...row });
      }
    }
  }
  return out;
}

async function main() {
  const curated = loadSeedFile();
  console.log(`Loaded ${curated.length} curated landmarks from seed JSON`);

  let osm = [];
  let google = [];
  if (!fileOnly) {
    try {
      console.log("Fetching OSM Overpass…");
      osm = await fetchOsmLandmarks();
      console.log(`OSM: ${osm.length} places`);
    } catch (err) {
      console.warn("OSM fetch failed, continuing with curated:", err.message);
    }
    const key = process.env.GOOGLE_PLACES_API_KEY || "";
    if (key) {
      try {
        console.log("Fetching Google Places Nearby…");
        google = await fetchGoogleNearby(key);
        console.log(`Google: ${google.length} places`);
      } catch (err) {
        console.warn("Google fetch failed:", err.message);
      }
    } else {
      console.log("GOOGLE_PLACES_API_KEY not set — skipping Google enrichment");
    }
  }

  // Prefer curated first so daerah/address stick for known places
  const merged = mergeLandmarks([curated, osm, google]);
  console.log(`Merged total: ${merged.length}`);

  if (dryRun) {
    console.log("Dry run — not writing Mongo");
    return;
  }

  const uri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/unified-report-penang";
  await connectDb(uri);
  await Landmark.deleteMany({});
  await Landmark.insertMany(merged);
  console.log(`Inserted ${merged.length} landmarks into Mongo`);

  const genPath = path.join(__dirname, "../data/landmarks.generated.json");
  fs.writeFileSync(
    genPath,
    JSON.stringify(
      merged.map((m) => ({
        name: m.name,
        aliases: m.aliases,
        category: m.category,
        lat: m.lat,
        lng: m.lng,
        daerah: m.daerah,
        side: m.side,
        source: m.source,
        osmId: m.osmId,
        googlePlaceId: m.googlePlaceId,
        address: m.address,
      })),
      null,
      2
    )
  );
  console.log(`Wrote generated snapshot to ${genPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
