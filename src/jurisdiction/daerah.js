import { pointInRing, locateRegion } from "./region.js";

/** Simplified 5 daerah rings [lng, lat]. Approximate admin split for labeling. */

/** Timur Laut — George Town / northeast island */
export const TIMUR_LAUT_RING = [
  [100.28, 5.36],
  [100.31, 5.34],
  [100.338, 5.34],
  [100.348, 5.38],
  [100.345, 5.41],
  [100.34, 5.435],
  [100.325, 5.455],
  [100.3, 5.47],
  [100.27, 5.478],
  [100.25, 5.46],
  [100.24, 5.43],
  [100.25, 5.4],
  [100.27, 5.38],
  [100.28, 5.36],
];

/** Barat Daya — Balik Pulau / Bayan Lepas / Sungai Rusa / SW island */
export const BARAT_DAYA_RING = [
  [100.165, 5.38],
  [100.168, 5.33],
  [100.175, 5.265],
  [100.205, 5.248],
  [100.25, 5.255],
  [100.285, 5.27],
  [100.31, 5.285],
  [100.325, 5.31],
  [100.338, 5.34],
  [100.31, 5.34],
  [100.28, 5.36],
  [100.27, 5.38],
  [100.25, 5.4],
  [100.24, 5.43],
  [100.23, 5.45],
  [100.195, 5.46],
  [100.175, 5.43],
  [100.165, 5.38],
];

/** Seberang Perai Utara — Kepala Batas / Butterworth north */
export const SPU_RING = [
  [100.35, 5.38],
  [100.555, 5.38],
  [100.555, 5.42],
  [100.53, 5.54],
  [100.4, 5.545],
  [100.365, 5.5],
  [100.352, 5.42],
  [100.35, 5.38],
];

/** Seberang Perai Tengah — Bukit Mertajam / Perai */
export const SPT_RING = [
  [100.35, 5.25],
  [100.555, 5.25],
  [100.555, 5.38],
  [100.35, 5.38],
  [100.35, 5.25],
];

/** Seberang Perai Selatan — Nibong Tebal / Simpang Ampat */
export const SPS_RING = [
  [100.35, 5.14],
  [100.52, 5.14],
  [100.555, 5.25],
  [100.35, 5.25],
  [100.35, 5.14],
];

export const DAERAH_IDS = [
  "timur_laut",
  "barat_daya",
  "spu",
  "spt",
  "sps",
];

export const DAERAH_LABELS = {
  timur_laut: "Timur Laut",
  barat_daya: "Barat Daya",
  spu: "Seberang Perai Utara",
  spt: "Seberang Perai Tengah",
  sps: "Seberang Perai Selatan",
  unknown: "Tidak pasti",
};

const DAERAH_RINGS = [
  ["timur_laut", TIMUR_LAUT_RING],
  ["barat_daya", BARAT_DAYA_RING],
  ["spu", SPU_RING],
  ["spt", SPT_RING],
  ["sps", SPS_RING],
];

export function locateDaerah(lat, lng) {
  for (const [id, ring] of DAERAH_RINGS) {
    if (pointInRing(lat, lng, ring)) return id;
  }
  const side = locateRegion(lat, lng);
  if (side === "pulau") return "barat_daya"; // island fallback SW-ish
  if (side === "seberang") return "spt";
  return "unknown";
}

export function daerahLabel(id) {
  return DAERAH_LABELS[id] || DAERAH_LABELS.unknown;
}
