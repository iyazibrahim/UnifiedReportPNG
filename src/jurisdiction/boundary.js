import { PULAU_RING, SEBERANG_RING, locateRegion, pointInRing } from "./region.js";

/** Max distance outside Penang polygons still accepted (metres). */
export const PENANG_BUFFER_M = 3000;

const EARTH_R = 6371000;

function toRad(d) {
  return (d * Math.PI) / 180;
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distance from point to segment (ring points are [lng, lat]). */
function distPointToSegmentM(lat, lng, aLng, aLat, bLng, bLat) {
  const ax = aLng;
  const ay = aLat;
  const bx = bLng;
  const by = bLat;
  const px = lng;
  const py = lat;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return haversineM(lat, lng, aLat, aLng);
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return haversineM(lat, lng, qy, qx);
}

export function minDistanceToRingM(lat, lng, ring) {
  let min = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [aLng, aLat] = ring[i];
    const [bLng, bLat] = ring[i + 1];
    const d = distPointToSegmentM(lat, lng, aLng, aLat, bLng, bLat);
    if (d < min) min = d;
  }
  return min;
}

export function minDistanceToPenangM(lat, lng) {
  if (pointInRing(lat, lng, PULAU_RING) || pointInRing(lat, lng, SEBERANG_RING)) {
    return 0;
  }
  return Math.min(
    minDistanceToRingM(lat, lng, PULAU_RING),
    minDistanceToRingM(lat, lng, SEBERANG_RING)
  );
}

/**
 * Allow pins inside Pulau/Seberang or within PENANG_BUFFER_M of the boundary.
 */
export function isAllowedPenangLocation(lat, lng, bufferM = PENANG_BUFFER_M) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    return { allowed: false, reason: "invalid", distanceM: null, region: "outside" };
  }
  const region = locateRegion(la, ln);
  if (region !== "outside") {
    return { allowed: true, reason: "inside", distanceM: 0, region };
  }
  const distanceM = minDistanceToPenangM(la, ln);
  if (distanceM <= bufferM) {
    return { allowed: true, reason: "buffer", distanceM, region: "outside" };
  }
  return { allowed: false, reason: "too_far", distanceM, region: "outside" };
}
