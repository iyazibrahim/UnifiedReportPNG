/**
 * Landmark category helpers for OSM/Google seed + worship reclassification.
 * Known categories: masjid, temple, shrine, church, gurdwara, school,
 * hospital, supermarket, apartment, mall, landmark, place_of_worship.
 */

export const LANDMARK_CATEGORIES = [
  "masjid",
  "temple",
  "shrine",
  "church",
  "gurdwara",
  "school",
  "hospital",
  "supermarket",
  "apartment",
  "mall",
  "landmark",
  "place_of_worship",
];

/**
 * Infer worship subcategory from a place name (BM/EN/local keywords).
 * @param {string} name
 * @returns {"masjid"|"temple"|"shrine"|"church"|"gurdwara"|"place_of_worship"}
 */
export function classifyWorshipFromName(name = "") {
  const n = String(name || "").toLowerCase();
  if (!n.trim()) return "place_of_worship";

  // Specific first
  if (
    /\b(gurdwara|gurudwara|gudwarah|kuil\s+sikh)\b/.test(n) ||
    /\bsikh\b/.test(n)
  ) {
    return "gurdwara";
  }

  if (
    /\b(masjid|surau|mosque|mussolla|musolla|musholla|musalla|madrasah)\b/.test(
      n
    )
  ) {
    return "masjid";
  }

  if (
    /\b(church|chruch|gereja|chapel|cathedral|basilica)\b/.test(n) ||
    /\b(methodist|baptist|anglican|catholic|presbyterian|lutheran|pentecostal)\b/.test(
      n
    ) ||
    /\b(assembly of god|gospel hall|christian|kingdomcity)\b/.test(n)
  ) {
    return "church";
  }

  if (
    /\b(shrine|keramat|dargha|dargah)\b/.test(n) ||
    /\b(datuk\s*gong|datuk\s*kong|dato\s*koyah|datuk\s*putih)\b/.test(n)
  ) {
    return "shrine";
  }

  if (
    /\b(temple|tokong|kuil|vihara|pagoda|kovil|wat\b)/.test(n) ||
    /\b(buddhist|buddha|hindu|taoist|iskcon|hare\s*krsna|hare\s*krishna)\b/.test(
      n
    ) ||
    /\b(tokong|thian|kongsi|tua pek kong|kuan yin|fo guang|foh san)\b/.test(
      n
    ) ||
    /\b(chinese temple|ancestral temple)\b/.test(n) ||
    /\b(persatuan agama buddha|persatuan buddhis|penganut dewa)\b/.test(n)
  ) {
    return "temple";
  }

  return "place_of_worship";
}

/**
 * Classify a place of worship from OSM tags + optional name fallback.
 * @param {Record<string, string>} tags
 * @param {string} [name]
 */
export function classifyWorshipCategory(tags = {}, name = "") {
  const religion = String(tags.religion || "").toLowerCase();
  const building = String(tags.building || "").toLowerCase();
  const amenity = String(tags.amenity || "").toLowerCase();
  const historic = String(tags.historic || "").toLowerCase();
  const denomination = String(tags.denomination || "").toLowerCase();
  const displayName = name || tags.name || "";

  if (
    historic === "shrine" ||
    amenity === "shrine" ||
    building === "shrine" ||
    tags.shrine
  ) {
    return "shrine";
  }

  if (
    religion === "muslim" ||
    religion === "islam" ||
    building === "mosque" ||
    denomination === "sunni" ||
    denomination === "shia"
  ) {
    return "masjid";
  }

  if (
    religion === "christian" ||
    building === "church" ||
    building === "chapel" ||
    building === "cathedral" ||
    building === "basilica"
  ) {
    return "church";
  }

  if (
    religion === "buddhist" ||
    religion === "taoist" ||
    religion === "hindu" ||
    religion === "jain" ||
    building === "temple" ||
    building === "pagoda"
  ) {
    return "temple";
  }

  if (religion === "sikh" || building === "gurdwara") {
    return "gurdwara";
  }

  return classifyWorshipFromName(displayName);
}

/**
 * Map OSM tags (any amenity/shop) to a landmark category.
 * @param {Record<string, string>} tags
 */
export function mapOsmCategory(tags = {}) {
  const amenity = String(tags.amenity || "").toLowerCase();
  const shop = String(tags.shop || "").toLowerCase();
  const building = String(tags.building || "").toLowerCase();
  const historic = String(tags.historic || "").toLowerCase();

  if (
    amenity === "place_of_worship" ||
    amenity === "shrine" ||
    historic === "shrine" ||
    tags.religion
  ) {
    return classifyWorshipCategory(tags, tags.name || "");
  }

  if (
    amenity === "school" ||
    amenity === "university" ||
    amenity === "college" ||
    amenity === "kindergarten"
  ) {
    return "school";
  }
  if (amenity === "hospital" || amenity === "clinic") return "hospital";
  if (shop === "supermarket" || shop === "convenience") return "supermarket";
  if (shop === "mall" || shop === "department_store") return "mall";
  if (building === "apartments" || building === "residential") return "apartment";
  return "landmark";
}

/**
 * Reclassify an existing seed row that may have been wrongly labeled masjid.
 * Only changes worship-related categories; leaves school/hospital/etc alone.
 * @param {{ name?: string, category?: string, aliases?: string[] }} row
 */
export function reclassifySeedCategory(row = {}) {
  const current = String(row.category || "landmark");
  const nameBlob = [row.name, ...(row.aliases || [])].filter(Boolean).join(" ");

  if (
    current === "masjid" ||
    current === "place_of_worship" ||
    current === "temple" ||
    current === "church" ||
    current === "shrine" ||
    current === "gurdwara"
  ) {
    return classifyWorshipFromName(nameBlob);
  }

  return current;
}
