/** Penang locality phrases — longest match first when stripping from queries. */
export const LOCALITY_PHRASES = [
  "george town",
  "pulau pinang",
  "balik pulau",
  "bayan lepas",
  "batu ferringhi",
  "bukit mertajam",
  "kepala batas",
  "tanjung bungah",
  "tanjung tokong",
  "sungai ara",
  "sungai dua",
  "sungai nibong",
  "sungai pinang",
  "sungai rusa",
  "air itam",
  "nibong tebal",
  "teluk bahang",
  "teluk kumbar",
  "bandar perda",
  "bandar sunway",
  "seberang jaya",
  "seberang perai",
  "butterworth",
  "bertam",
  "penaga",
  "perai",
  "jelutong",
  "gelugor",
  "minden",
  "komtar",
  "prai",
  "simpang",
  "alma",
  "jawi",
  "valdor",
  "machang bubok",
  "tasek",
  "bagan",
  "permatang",
  "penang",
  "pulau",
].sort((a, b) => b.length - a.length);

/** Map locality phrase → daerah id for DB filtering. */
export const LOCALITY_TO_DAERAH = {
  "george town": "timur_laut",
  komtar: "timur_laut",
  "pulau tikus": "timur_laut",
  "air itam": "timur_laut",
  jelutong: "timur_laut",
  gelugor: "timur_laut",
  minden: "timur_laut",
  "balik pulau": "barat_daya",
  "bayan lepas": "barat_daya",
  "teluk kumbar": "barat_daya",
  "sungai ara": "barat_daya",
  "sungai rusa": "barat_daya",
  "batu ferringhi": "barat_daya",
  "teluk bahang": "barat_daya",
  "tanjung bungah": "barat_daya",
  "tanjung tokong": "barat_daya",
  butterworth: "spt",
  bertam: "spu",
  "kepala batas": "spu",
  penaga: "spu",
  "bukit mertajam": "spt",
  perai: "spt",
  "seberang jaya": "spt",
  "nibong tebal": "sps",
  "sungai nibong": "sps",
  "sungai pinang": "sps",
  prai: "spt",
  simpang: "spu",
  alma: "spt",
  jawi: "sps",
  valdor: "sps",
  "machang bubok": "sps",
  tasek: "spt",
  bagan: "spu",
  permatang: "spu",
};

export function normalizeLocalityText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split query into POI remainder and matched locality phrase.
 * @returns {{ locality: string, poiText: string, daerahHint: string | null }}
 */
export function splitPoiAndLocality(query) {
  const q = normalizeLocalityText(query);
  if (!q) return { locality: "", poiText: "", daerahHint: null };

  for (const phrase of LOCALITY_PHRASES) {
    if (q === phrase || q.endsWith(` ${phrase}`) || q.startsWith(`${phrase} `) || q.includes(` ${phrase} `)) {
      const poiText = q.replace(phrase, " ").replace(/\s+/g, " ").trim();
      return {
        locality: phrase,
        poiText,
        daerahHint: LOCALITY_TO_DAERAH[phrase] || null,
      };
    }
  }
  return { locality: "", poiText: q, daerahHint: null };
}

export function daerahMatchesLocality(landmarkDaerah, locality, daerahHint) {
  if (!landmarkDaerah || landmarkDaerah === "unknown") return true;
  if (daerahHint && landmarkDaerah === daerahHint) return true;
  if (!locality) return true;
  const loc = normalizeLocalityText(locality);
  const daerahNames = {
    timur_laut: ["george town", "komtar", "air itam", "jelutong", "gelugor", "minden", "timur laut"],
    barat_daya: ["balik pulau", "bayan lepas", "teluk kumbar", "sungai ara", "sungai rusa", "barat daya"],
    spu: ["kepala batas", "bertam", "penaga", "simpang", "bagan", "permatang", "seberang perai utara"],
    spt: ["butterworth", "bukit mertajam", "perai", "seberang jaya", "prai", "alma", "tasek", "seberang perai tengah"],
    sps: ["nibong tebal", "sungai nibong", "sungai pinang", "jawi", "valdor", "seberang perai selatan"],
  };
  const hints = daerahNames[landmarkDaerah] || [];
  return hints.some((h) => loc.includes(h) || h.includes(loc));
}
