import {
  resolveConfig,
  resolveToggle,
} from "../settings/service.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** Penang-ish viewbox: west,south,east,north */
const PENANG_VIEWBOX = "100.15,5.15,100.55,5.55";

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

/**
 * Forward geocode a place query, biased to Penang.
 * @returns {{ lat, lng, display_name, road, suburb, city, postcode, raw } | null}
 */
export async function forwardGeocode(query, { userAgent, fetchImpl } = {}) {
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
  const best = pickPenangHit(rows) || rows[0];
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

function pickPenangHit(rows) {
  const [west, south, east, north] = PENANG_VIEWBOX.split(",").map(Number);
  return (
    rows.find((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      return lat >= south && lat <= north && lng >= west && lng <= east;
    }) || null
  );
}

/** Try queries in order until Nominatim returns a hit. */
export async function forwardGeocodeCandidates(
  queries,
  { userAgent, fetchImpl } = {}
) {
  const seen = new Set();
  for (const q of queries || []) {
    const key = String(q || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hit = await forwardGeocode(q, { userAgent, fetchImpl });
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
      return hit;
    }
  }
  return null;
}
