/**
 * Optional OSM named-highway seed for Street collection (Penang bbox).
 *
 * Usage:
 *   node scripts/seed-streets.js
 *   node scripts/seed-streets.js --dry-run
 */
import "dotenv/config";
import { connectDb } from "../src/db.js";
import { Street } from "../src/models/Street.js";
import { locateDaerah } from "../src/jurisdiction/daerah.js";
import { invalidateStreetCache } from "../src/location/streetStore.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const PENANG_BBOX = "5.14,100.15,5.55,100.55"; // south,west,north,east
const dryRun = process.argv.includes("--dry-run");

async function fetchNamedHighways() {
  const query = `
    [out:json][timeout:180];
    (
      way["highway"]["name"](${PENANG_BBOX});
    );
    out center tags;
  `;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const body = await res.json();
  return body.elements || [];
}

function normalize(n) {
  return String(n || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  await connectDb(process.env.MONGODB_URI);
  console.log("Fetching named highways from Overpass…");
  const elements = await fetchNamedHighways();
  console.log(`Got ${elements.length} ways`);

  let created = 0;
  let skipped = 0;
  for (const el of elements) {
    const name = el.tags?.name;
    const lat = el.center?.lat ?? el.lat;
    const lng = el.center?.lon ?? el.lon;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }
    if (dryRun) {
      created++;
      continue;
    }
    const existing = await Street.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      lat: { $gte: lat - 0.002, $lte: lat + 0.002 },
      lng: { $gte: lng - 0.002, $lte: lng + 0.002 },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await Street.create({
      name: String(name).slice(0, 120),
      aliases: [],
      lat,
      lng,
      daerah: locateDaerah(lat, lng) || "unknown",
      source: "osm",
      confirmCount: 1,
    });
    created++;
  }
  invalidateStreetCache();
  console.log({ created, skipped, dryRun, normalizeSample: normalize("Jalan Burma") });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
