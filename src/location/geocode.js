const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

export async function reverseGeocode(lat, lng, { userAgent, fetchImpl } = {}) {
  const fetchFn = fetchImpl || fetch;
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const res = await fetchFn(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent || "UnifiedReportPenang/1.0 (mvp)",
    },
  });
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
