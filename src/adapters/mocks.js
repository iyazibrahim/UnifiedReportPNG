import { toDispatchPayload } from "../cases/payload.js";

const PREFIX = {
  pearl_mbpp: "PEARL",
  aspire_mbsp: "ASPIRE",
  myjalan: "MYJALAN",
  pbapp: "PBAPP",
  epintas: "EPINTAS",
};

/** Stable unique mock ticket id — never recycle PEARL-0001 after restarts. */
export function buildExternalRef(agencyId, caseRef) {
  const prefix = PREFIX[agencyId] || "TICKET";
  const raw = String(caseRef || "").trim();
  const suffix = raw.replace(/^PG-/i, "") || `${Date.now().toString(36)}`;
  return `${prefix}-${suffix}`;
}

export function createMemoryAdapters(store) {
  const adapters = {};
  for (const agencyId of Object.keys(PREFIX)) {
    adapters[agencyId] = {
      async submit(caseDoc) {
        const externalRef = buildExternalRef(agencyId, caseDoc.ref);
        const payload = toDispatchPayload(caseDoc);
        const ticket = {
          adapterId: agencyId,
          externalRef,
          caseRef: caseDoc.ref,
          payload,
        };
        store.push(ticket);
        return { externalRef, raw: ticket };
      },
    };
  }
  return adapters;
}

export { PREFIX };
