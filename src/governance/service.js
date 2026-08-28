import { Settings } from "../models/Settings.js";
import { defaultSlaHours } from "../adapters/official.js";
import { AGENCIES } from "../jurisdiction/categories.js";

const DEFAULT_GOVERNANCE = {
  dataControllerName: "",
  superAdminNames: "",
  retentionYearsMetadata: "7",
  retentionYearsPhotos: "2",
  slaHoursJson: JSON.stringify(
    Object.fromEntries(
      Object.keys(AGENCIES).map((id) => [id, String(defaultSlaHours(id))])
    )
  ),
  vendorAccessNotes: "",
};

export async function getGovernance() {
  const doc = await Settings.findOne({ singletonKey: "default" }).lean();
  return {
    ...DEFAULT_GOVERNANCE,
    ...(doc?.governance || {}),
  };
}

export async function patchGovernance(body, { updatedBy } = {}) {
  const doc = await Settings.findOne({ singletonKey: "default" });
  if (!doc) throw new Error("Settings not found");
  doc.governance = doc.governance || {};
  const allowed = Object.keys(DEFAULT_GOVERNANCE);
  for (const key of allowed) {
    if (body[key] !== undefined) {
      doc.governance[key] = String(body[key] ?? "");
    }
  }
  if (updatedBy) doc.updatedBy = updatedBy;
  doc.markModified("governance");
  await doc.save();
  return getGovernance();
}

export async function getSlaHoursForAgency(agencyId) {
  const gov = await getGovernance();
  try {
    const map = JSON.parse(gov.slaHoursJson || "{}");
    const hours = Number(map[agencyId]);
    if (Number.isFinite(hours) && hours > 0) return hours;
  } catch {
    /* ignore */
  }
  return defaultSlaHours(agencyId);
}

export function governanceReady(gov) {
  return Boolean(
    gov.dataControllerName?.trim() && gov.superAdminNames?.trim()
  );
}

export { DEFAULT_GOVERNANCE };
