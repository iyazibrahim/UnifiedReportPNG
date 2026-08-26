import { createMemoryAdapters } from "./mocks.js";
import { MockTicket } from "../models/MockTicket.js";

export function createPersistedAdapters() {
  const memory = [];
  const adapters = createMemoryAdapters(memory);
  const wrapped = {};
  for (const [agencyId, adapter] of Object.entries(adapters)) {
    wrapped[agencyId] = {
      async submit(caseDoc) {
        const result = await adapter.submit(caseDoc);
        await MockTicket.create(result.raw);
        return result;
      },
    };
  }
  return wrapped;
}
