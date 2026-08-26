/** GeoJSON rings [lng, lat]. Simplified official admin split: island vs Seberang Perai. */
export const PULAU_RING = [
  [100.175, 5.265],
  [100.205, 5.248],
  [100.25, 5.255],
  [100.285, 5.27],
  [100.31, 5.285],
  [100.325, 5.31],
  [100.338, 5.34],
  [100.345, 5.38],
  [100.348, 5.41],
  [100.34, 5.435],
  [100.325, 5.455],
  [100.3, 5.47],
  [100.27, 5.478],
  [100.23, 5.475],
  [100.195, 5.46],
  [100.175, 5.43],
  [100.165, 5.38],
  [100.168, 5.33],
  [100.175, 5.265],
];

export const SEBERANG_RING = [
  [100.35, 5.14],
  [100.52, 5.14],
  [100.555, 5.25],
  [100.555, 5.42],
  [100.53, 5.54],
  [100.4, 5.545],
  [100.365, 5.5],
  [100.352, 5.42],
  [100.352, 5.34],
  [100.35, 5.25],
  [100.35, 5.14],
];

export function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function locateRegion(lat, lng) {
  if (pointInRing(lat, lng, PULAU_RING)) return "pulau";
  if (pointInRing(lat, lng, SEBERANG_RING)) return "seberang";
  return "outside";
}
