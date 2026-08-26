import { toDispatchPayload } from "../cases/payload.js";

const PREFIX = {
  pearl_mbpp: "PEARL",
  aspire_mbsp: "ASPIRE",
  myjalan: "MYJALAN",
  pbapp: "PBAPP",
  epintas: "EPINTAS",
};

export function createMemoryAdapters(store) {
  const counters = {};
  const adapters = {};
  for (const [agencyId, prefix] of Object.entries(PREFIX)) {
    counters[agencyId] = 0;
    adapters[agencyId] = {
      async submit(caseDoc) {
        counters[agencyId] += 1;
        const externalRef = `${prefix}-${String(counters[agencyId]).padStart(4, "0")}`;
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
