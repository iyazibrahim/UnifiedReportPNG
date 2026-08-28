import { resolveSecret } from "../settings/service.js";
import { AGENCIES } from "../jurisdiction/categories.js";

const API_BASE = {
  pearl_mbpp: "https://api.pearl.example/aduan",
  aspire_mbsp: "https://api.aspire.example/aduan",
  myjalan: "https://api.myjalan.example/reports",
  pbapp: "https://api.pbapp.example/aduan",
  epintas: "https://api.epintas.example/reports",
};

const SECRET_KEY = {
  pearl_mbpp: "pearlApiKey",
  aspire_mbsp: "aspireApiKey",
  myjalan: "myjalanApiKey",
  pbapp: "pbappApiKey",
  epintas: "epintasApiKey",
};

/**
 * Optional register into official agency API when key is configured.
 * Local MockTicket remains source of truth for citizen status.
 */
export async function registerWithOfficialApi(agencyId, caseDoc, externalRef) {
  const secretKey = SECRET_KEY[agencyId];
  if (!secretKey) {
    return { attempted: false, reason: "no_adapter" };
  }
  const { value: apiKey } = await resolveSecret(secretKey);
  if (!apiKey) {
    return { attempted: false, reason: "no_api_key" };
  }
  const base = API_BASE[agencyId];
  if (!base) {
    return { attempted: false, reason: "no_endpoint" };
  }
  const payload = {
    externalRef,
    caseRef: caseDoc.ref,
    category: caseDoc.classification?.categoryId,
    text: caseDoc.intake?.text,
    location: caseDoc.location,
    submittedAt: new Date().toISOString(),
  };
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-OnePenang-Agency": agencyId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        attempted: true,
        ok: false,
        status: res.status,
        error: text.slice(0, 500) || res.statusText,
      };
    }
    const data = await res.json().catch(() => ({}));
    return {
      attempted: true,
      ok: true,
      externalId: data.id || data.ticketId || null,
      response: data,
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      error: err.message,
    };
  }
}

export function defaultSlaHours(agencyId) {
  const defaults = {
    pearl_mbpp: 72,
    aspire_mbsp: 72,
    myjalan: 120,
    pbapp: 48,
    epintas: 72,
  };
  return defaults[agencyId] || 72;
}

export function computeDueAt(createdAt, hours) {
  const d = new Date(createdAt);
  d.setHours(d.getHours() + Number(hours || 72));
  return d;
}

export { AGENCIES };
