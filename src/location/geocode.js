import {
  resolveConfig,
  resolveToggle,
} from "../settings/service.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** Penang-ish viewbox: west,south,east,north */
const PENANG_VIEWBOX = "100.15,5.15,100.55,5.55";

const POI_QUERY_TOKENS = new Set([
  "mart",
  "mall",
  "market",
  "hospital",
  "klinik",
  "clinic",
  "masjid",
  "mosque",
  "surau",
  "school",
  "sekolah",
  "smk",
  "sk",
  "universiti",
  "college",
  "petronas",
  "shell",
  "bhp",
  "caltex",
  "lotus",
  "giant",
  "mydin",
  "aeon",
  "tesco",
  "familymart",
  "speedmart",
  "7eleven",
  "eleven",
  "tf",
  "kedai",
  "restoran",
  "restaurant",
  "hotel",
  "terminal",
  "jetty",
  "stesen",
  "station",
]);

async function nominatimHeaders(userAgent, envProcess) {
  const ua =
    userAgent ||
    (
      await resolveConfig(
        "nominatimUserAgent",
        envProcess || process.env,
        "UnifiedReportPenang/1.0"
      )
    ).value;
  return {
    Accept: "application/json",
    "User-Agent": ua,
  };
}

function queryHasPoiTokens(query) {
  const words = String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.some((w) => POI_QUERY_TOKENS.has(w));
}

function nominatimRowScore(row, query) {
  let score = 0;
  const type = String(row.type || "").toLowerCase();
  const klass = String(row.class || "").toLowerCase();
  const importance = Number(row.importance) || 0;

  if (klass === "shop" || klass === "amenity" || klass === "building") score += 4;
  if (klass === "highway" || klass === "railway") score += 2;
  if (type === "administrative") score -= 5;
  if (klass === "place" && ["city", "town", "village", "suburb"].includes(type)) {
    score -= queryHasPoiTokens(query) ? 6 : 1;
  }
  score += importance * 2;
  return score;
}

export function rankNominatimHits(rows, query) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  return [...rows].sort(
    (a, b) => nominatimRowScore(b, query) - nominatimRowScore(a, query)
  );
}

export async function reverseGeocode(lat, lng, { userAgent, fetchImpl } = {}) {
  if (!(await resolveToggle("nominatimEnabled"))) {
    return {
      display_name: null,
      road: null,
      raw: { skipped: "nominatim_disabled" },
    };
  }

  const fetchFn = fetchImpl || fetch;
  const headers = await nominatimHeaders(userAgent);

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const res = await fetchFn(url, { headers });
  if (!res.ok) {
    return { display_name: null, road: null, raw: { error: res.status } };
  }
  const raw = await res.json();
  const address = raw.address || {};
  return {
    display_name: raw.display_name || null,
    road: address.road || address.pedestrian || address.path || null,
    suburb: address.suburb || address.neighbourhood || address.village || null,
    city: address.city || address.town || address.county || null,
    postcode: address.postcode || null,
    raw,
  };
}

function pickPenangHit(rows, query) {
  const [west, south, east, north] = PENANG_VIEWBOX.split(",").map(Number);
  const inBox = rows.filter((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    return lat >= south && lat <= north && lng >= west && lng <= east;
  });
  const pool = inBox.length ? inBox : rows;
  const ranked = rankNominatimHits(pool, query);
  return ranked[0] || null;
}

function rowToHit(best, q) {
  const address = best.address || {};
  return {
    lat: Number(best.lat),
    lng: Number(best.lon),
    display_name: best.display_name || null,
    road: address.road || address.pedestrian || address.path || null,
    suburb: address.suburb || address.neighbourhood || address.village || null,
    city: address.city || address.town || address.county || null,
    postcode: address.postcode || null,
    raw: best,
    query: q,
  };
}

/**
 * Forward geocode a place query, biased to Penang.
 * @returns {{ lat, lng, display_name, road, suburb, city, postcode, raw } | null}
 */
export async function forwardGeocode(
  query,
  { userAgent, fetchImpl, queryContext } = {}
) {
  if (!(await resolveToggle("nominatimEnabled"))) {
    return null;
  }
  const q = String(query || "").trim();
  if (!q) return null;

  const fetchFn = fetchImpl || fetch;
  const headers = await nominatimHeaders(userAgent);

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "my");
  url.searchParams.set("viewbox", PENANG_VIEWBOX);
  url.searchParams.set("bounded", "0");

  const res = await fetchFn(url, { headers });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  const best = pickPenangHit(rows, queryContext || q);
  if (!best) return null;
  return rowToHit(best, q);
}

/**
 * Return raw Nominatim search rows (for street candidate ranking).
 */
export async function searchGeocodeRows(
  query,
  { userAgent, fetchImpl, limit = 10 } = {}
) {
  if (!(await resolveToggle("nominatimEnabled"))) {
    return [];
  }
  const q = String(query || "").trim();
  if (!q) return [];

  const fetchFn = fetchImpl || fetch;
  const headers = await nominatimHeaders(userAgent);

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "my");
  url.searchParams.set("viewbox", PENANG_VIEWBOX);
  url.searchParams.set("bounded", "0");

  const res = await fetchFn(url, { headers });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

/** Try queries in order until Nominatim returns a hit. */
export async function forwardGeocodeCandidates(
  queries,
  { userAgent, fetchImpl, queryContext } = {}
) {
  const seen = new Set();
  for (const q of queries || []) {
    const key = String(q || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hit = await forwardGeocode(q, {
      userAgent,
      fetchImpl,
      queryContext: queryContext || q,
    });
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
      return hit;
    }
  }
  return null;
}
