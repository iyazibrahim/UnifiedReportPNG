/**
 * Bulk-expand landmarks.seed.json via Overpass (category-by-category) + Nominatim fallback.
 * Preserves curated aliases when merging.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locateDaerah, daerahLabel } from "../src/jurisdiction/daerah.js";
import { locateRegion } from "../src/jurisdiction/region.js";
import {
  mapOsmCategory,
  classifyWorshipFromName,
} from "../src/location/landmarkCategory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, "../data/landmarks.seed.json");
const ENDPOINTS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const BBOX = "5.14,100.15,5.55,100.55";
const VIEWBOX = "100.15,5.55,100.55,5.14"; // left,top,right,bottom for Nominatim
const UA = "UnifiedReportPenang/1.0 (landmark-seed)";

const QUERIES = [
  // Worship: category resolved from OSM religion/building tags + name
  { category: null, ql: 'node["amenity"="place_of_worship"]["name"]' },
  { category: null, ql: 'way["amenity"="place_of_worship"]["name"]' },
  { category: null, ql: 'node["historic"="shrine"]["name"]' },
  { category: "school", ql: 'node["amenity"="school"]["name"]' },
  { category: "school", ql: 'way["amenity"="school"]["name"]' },
  { category: "school", ql: 'node["amenity"="university"]["name"]' },
  { category: "school", ql: 'node["amenity"="college"]["name"]' },
  { category: "hospital", ql: 'node["amenity"="hospital"]["name"]' },
  { category: "hospital", ql: 'way["amenity"="hospital"]["name"]' },
  { category: "hospital", ql: 'node["amenity"="clinic"]["name"]' },
  { category: "supermarket", ql: 'node["shop"="supermarket"]["name"]' },
  { category: "supermarket", ql: 'way["shop"="supermarket"]["name"]' },
  { category: "supermarket", ql: 'node["shop"="convenience"]["name"]' },
  { category: "mall", ql: 'node["shop"="mall"]["name"]' },
  { category: "mall", ql: 'way["shop"="mall"]["name"]' },
  { category: "mall", ql: 'node["shop"="department_store"]["name"]' },
  { category: "apartment", ql: 'node["building"="apartments"]["name"]' },
  { category: "apartment", ql: 'way["building"="apartments"]["name"]' },
  { category: "landmark", ql: 'node["amenity"="ferry_terminal"]["name"]' },
  { category: "landmark", ql: 'node["amenity"="police"]["name"]' },
  { category: "landmark", ql: 'node["amenity"="fire_station"]["name"]' },
  { category: "landmark", ql: 'node["tourism"="attraction"]["name"]' },
  { category: "landmark", ql: 'way["tourism"="attraction"]["name"]' },
  { category: "landmark", ql: 'node["leisure"="park"]["name"]' },
  { category: "landmark", ql: 'way["leisure"="park"]["name"]' },
  { category: "landmark", ql: 'node["tourism"="hotel"]["name"]' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normalizeName(n) {
  return String(n || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function enrich(row) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const daerah =
    row.daerah && row.daerah !== "unknown" ? row.daerah : locateDaerah(lat, lng);
  let side = row.side || locateRegion(lat, lng);
  if (side === "outside") side = String(daerah).startsWith("sp") ? "seberang" : "pulau";
  return {
    name: row.name,
    aliases: [...new Set((row.aliases || []).filter(Boolean))],
    category: row.category || "landmark",
    lat,
    lng,
    daerah,
    side,
    source: row.source || "osm",
    osmId: row.osmId || null,
    googlePlaceId: row.googlePlaceId || null,
    address: row.address || `${row.name}, ${daerahLabel(daerah)}, Pulau Pinang`,
  };
}

async function overpassOnce(endpoint, ql, category) {
  const query = `[out:json][timeout:60];(${ql}(${BBOX}););out center tags;`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": UA,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const body = await res.json();
  const rows = [];
  for (const el of body.elements || []) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const aliases = [];
    for (const k of ["name:en", "name:ms", "alt_name", "short_name"]) {
      if (tags[k] && tags[k] !== name) aliases.push(tags[k]);
    }
    const resolved =
      category ||
      mapOsmCategory(tags) ||
      classifyWorshipFromName(name);
    rows.push(
      enrich({
        name,
        aliases,
        category: resolved,
        lat,
        lng,
        source: "osm",
        osmId: `${el.type}/${el.id}`,
      })
    );
  }
  return rows;
}

async function fetchAllOverpass() {
  const all = [];
  for (const endpoint of ENDPOINTS) {
    console.log(`Endpoint: ${endpoint}`);
    let ok = 0;
    for (const { category, ql } of QUERIES) {
      try {
        const rows = await overpassOnce(endpoint, ql, category);
        all.push(...rows);
        ok += 1;
        process.stdout.write(`.${rows.length}`);
        await sleep(1200);
      } catch (err) {
        process.stdout.write(`x(${err.message})`);
        await sleep(2000);
      }
    }
    console.log(`\nBatches ok on this endpoint: ${ok}/${QUERIES.length}`);
    if (all.length > 100) break;
  }
  return all;
}

/** Nominatim amenity search fallback (slower, fewer results). */
async function fetchNominatimFallback() {
  const searches = [
    { q: "masjid Penang", category: "masjid" },
    { q: "tokong Penang", category: "temple" },
    { q: "temple Penang", category: "temple" },
    { q: "kuil Penang", category: "temple" },
    { q: "church Penang", category: "church" },
    { q: "gereja Penang", category: "church" },
    { q: "gurdwara Penang", category: "gurdwara" },
    { q: "sekolah Penang", category: "school" },
    { q: "hospital Penang", category: "hospital" },
    { q: "supermarket Penang", category: "supermarket" },
    { q: "mall Penang", category: "mall" },
    { q: "apartment Penang", category: "apartment" },
    { q: "taman Penang", category: "landmark" },
    { q: "pasar Penang", category: "landmark" },
    { q: "masjid Seberang Perai", category: "masjid" },
    { q: "tokong Seberang Perai", category: "temple" },
    { q: "sekolah Seberang Perai", category: "school" },
    { q: "hospital Seberang Perai", category: "hospital" },
    { q: "masjid Balik Pulau", category: "masjid" },
    { q: "masjid Butterworth", category: "masjid" },
    { q: "masjid Bukit Mertajam", category: "masjid" },
    { q: "7-Eleven Penang", category: "supermarket" },
    { q: "KK Mart Penang", category: "supermarket" },
    { q: "FamilyMart Penang", category: "supermarket" },
  ];
  const rows = [];
  for (const s of searches) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", s.q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "30");
    url.searchParams.set("countrycodes", "my");
    url.searchParams.set("viewbox", VIEWBOX);
    url.searchParams.set("bounded", "1");
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const hit of data) {
        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const name = hit.name || hit.display_name?.split(",")[0];
        if (!name) continue;
        rows.push(
          enrich({
            name,
            aliases: [],
            category: s.category,
            lat,
            lng,
            source: "osm",
            osmId: hit.osm_type && hit.osm_id ? `${hit.osm_type}/${hit.osm_id}` : null,
            address: hit.display_name,
          })
        );
      }
      console.log(`Nominatim "${s.q}": ${data.length}`);
    } catch (err) {
      console.warn(s.q, err.message);
    }
    await sleep(1100);
  }
  return rows;
}

function merge(lists) {
  const out = [];
  for (const list of lists) {
    for (const raw of list) {
      const row = enrich(raw);
      const dup = out.find(
        (x) =>
          (row.osmId && x.osmId === row.osmId) ||
          (haversineM(x.lat, x.lng, row.lat, row.lng) < 45 &&
            (normalizeName(x.name) === normalizeName(row.name) ||
              x.aliases.some((a) => normalizeName(a) === normalizeName(row.name)) ||
              row.aliases.some((a) => normalizeName(a) === normalizeName(x.name))))
      );
      if (dup) {
        dup.aliases = [
          ...new Set(
            [...(dup.aliases || []), ...(row.aliases || []), row.name !== dup.name ? row.name : null].filter(
              Boolean
            )
          ),
        ];
        if (raw.source === "curated" || raw.daerah) {
          if (raw.daerah) dup.daerah = raw.daerah;
          if (raw.side) dup.side = raw.side;
          if (raw.address) dup.address = raw.address;
          for (const a of raw.aliases || []) dup.aliases.push(a);
          dup.aliases = [...new Set(dup.aliases)];
          dup.source = dup.osmId ? "merged" : "curated";
        } else if (row.osmId) {
          dup.osmId = row.osmId;
          if (dup.source === "curated") dup.source = "merged";
        }
      } else {
        out.push(row);
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  console.log(`Existing seed: ${existing.length}`);

  let osm = [];
  try {
    osm = await fetchAllOverpass();
    console.log(`Overpass total rows: ${osm.length}`);
  } catch (err) {
    console.warn("Overpass failed:", err.message);
  }

  if (osm.length < 80) {
    console.log("Falling back to Nominatim searches…");
    const nom = await fetchNominatimFallback();
    osm = [...osm, ...nom];
  }

  const merged = merge([existing, osm]);
  const byCat = {};
  const byDaerah = {};
  for (const m of merged) {
    byCat[m.category] = (byCat[m.category] || 0) + 1;
    byDaerah[m.daerah] = (byDaerah[m.daerah] || 0) + 1;
  }
  console.log(`Merged total: ${merged.length}`);
  console.log("By category:", byCat);
  console.log("By daerah:", byDaerah);

  fs.writeFileSync(SEED_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Wrote ${SEED_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
