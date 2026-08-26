import { AGENCIES, CATEGORIES } from "./categories.js";
import { locateRegion } from "./region.js";

const MAJOR_ROAD_RE =
  /\b(lebuhraya|highway|federal|persekutuan|plus|utara-selatan|north-south|jambatan pulau pinang|penang bridge)\b/i;

export function isMajorRoadLabel(label) {
  if (!label) return false;
  const text = `${label.display_name || ""} ${label.road || ""}`;
  return MAJOR_ROAD_RE.test(text);
}

function result(agencyId, reason, confidence, needsTriage) {
  const agency = AGENCIES[agencyId];
  return {
    agencyId,
    agencyLabel: agency.label,
    reason,
    confidence,
    needsTriage,
  };
}

function pbtForRegion(region, categoryLabel) {
  if (region === "pulau") {
    return result(
      "pearl_mbpp",
      `Pin di Pulau Pinang + ${categoryLabel} → Pearl eAduan (MBPP).`,
      "high",
      false
    );
  }
  if (region === "seberang") {
    return result(
      "aspire_mbsp",
      `Pin di Seberang Perai + ${categoryLabel} → Aspire eAduan (MBSP).`,
      "high",
      false
    );
  }
  return result(
    "epintas",
    `Lokasi di luar sempadan PBT Pulau Pinang yang dikenali. Dihantar ke ePINTAS untuk triaj.`,
    "low",
    true
  );
}

export function resolveJurisdiction({ categoryId, lat, lng, label }) {
  const category = CATEGORIES[categoryId] || CATEGORIES.lain_lain;
  const region = locateRegion(lat, lng);

  if (category.owner === "pbapp") {
    return result(
      "pbapp",
      "Bekalan air di seluruh Pulau Pinang di bawah PBAPP.",
      "high",
      false
    );
  }

  if (category.owner === "epintas") {
    return result(
      "epintas",
      `${category.label} memerlukan triaj negeri (ePINTAS / JPS / agensi berkaitan).`,
      "medium",
      true
    );
  }

  if (category.owner === "myjalan") {
    return result(
      "myjalan",
      `${category.label} disalur ke MyJalan (No Wrong Door untuk isyarat/papan tanda jalan).`,
      "medium",
      false
    );
  }

  if (category.owner === "road") {
    if (isMajorRoadLabel(label)) {
      return result(
        "myjalan",
        `Nama cadangan nampak jalan besar/lebuhraya → MyJalan. Pin kekal ${lat.toFixed(4)}, ${lng.toFixed(4)}.`,
        "medium",
        false
      );
    }
    if (region === "outside") {
      return result(
        "myjalan",
        "Isu jalan tetapi pin di luar sempadan PBT yang dikenali → MyJalan (No Wrong Door), triaj.",
        "low",
        true
      );
    }
    return pbtForRegion(region, category.label);
  }

  return pbtForRegion(region, category.label);
}
