export const ACCURACY_THRESHOLD_M = 80;

export const GPS_SOURCES = new Set([
  "whatsapp_pin",
  "telegram_current",
  "telegram_picked",
]);

export function isGpsSource(source) {
  return GPS_SOURCES.has(source);
}

export function captureTruth(telegramLocation, opts = {}) {
  const accuracy =
    telegramLocation.horizontal_accuracy == null
      ? null
      : Number(telegramLocation.horizontal_accuracy);
  const source =
    opts.source ||
    (accuracy != null ? "telegram_current" : "telegram_picked");
  return {
    lat: Number(telegramLocation.latitude),
    lng: Number(telegramLocation.longitude),
    accuracy_m: accuracy,
    source,
    captured_at: new Date().toISOString(),
    confirmed: false,
    confirmed_at: null,
    method: null,
  };
}

/** Truth from Nominatim forward geocode (landmark / typed place). */
export function captureGeocodedTruth({ lat, lng, source = "text_geocode", landmark = null }) {
  return {
    lat: Number(lat),
    lng: Number(lng),
    accuracy_m: null,
    source,
    captured_at: new Date().toISOString(),
    confirmed: false,
    confirmed_at: null,
    method: null,
    landmark: landmark ? String(landmark).trim() : null,
  };
}

export function needsMapPick(truth) {
  return (
    (truth.source === "telegram_current" || truth.source === "whatsapp_pin") &&
    truth.accuracy_m != null &&
    truth.accuracy_m > ACCURACY_THRESHOLD_M
  );
}

export function applyLabel(truth, geocode = {}) {
  return {
    ...truth,
    lat: truth.lat,
    lng: truth.lng,
    display_name: geocode.display_name ?? null,
    road: geocode.road ?? truth.road ?? null,
    suburb: geocode.suburb ?? null,
    city: geocode.city ?? null,
    postcode: geocode.postcode ?? null,
    raw: geocode.raw ?? null,
    fetched_at: new Date().toISOString(),
    landmark: truth.landmark ?? null,
    address_override: truth.address_override ?? null,
    road_source: truth.road_source ?? null,
    road_user_raw: truth.road_user_raw ?? null,
    road_confirmed: truth.road_confirmed ?? false,
  };
}

/**
 * Set verified or user-provided street name on location (pin unchanged).
 */
export function setStreetName(
  location,
  { road, road_source, road_user_raw = null, road_confirmed = true } = {}
) {
  return {
    ...location,
    road: road ? String(road).trim() : null,
    road_source: road_source || null,
    road_user_raw: road_user_raw ? String(road_user_raw).trim() : null,
    road_confirmed: Boolean(road_confirmed),
  };
}

export function skipStreetName(location) {
  return {
    ...location,
    road_source: "skipped",
    road_confirmed: false,
  };
}

export function confirmLocation(location, method) {
  return {
    ...location,
    confirmed: true,
    confirmed_at: new Date().toISOString(),
    method,
  };
}

export function replaceTruth(newTruth) {
  return {
    ...newTruth,
    confirmed: false,
    confirmed_at: null,
    method: null,
    display_name: null,
    road: null,
    suburb: null,
    city: null,
    postcode: null,
    raw: null,
    fetched_at: null,
    landmark: null,
    address_override: null,
    road_source: null,
    road_user_raw: null,
    road_confirmed: false,
  };
}

export function addLandmark(location, landmark) {
  return {
    ...location,
    landmark: String(landmark).trim(),
  };
}

export function formatConfirmMessage(location) {
  const acc =
    location.accuracy_m != null
      ? ` (±${Math.round(location.accuracy_m)} m)`
      : "";
  const name = location.display_name || "tiada cadangan nama";
  return [
    `Lokasi dikunci: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}${acc}`,
    "",
    `Cadangan nama: ${name}`,
    "(Nama ni mungkin jalan besar berdekatan — pin pada peta adalah yang betul.)",
  ].join("\n");
}
