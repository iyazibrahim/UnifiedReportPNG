import { createMemoryAdapters } from "./mocks.js";
import { MockTicket } from "../models/MockTicket.js";
import {
  registerWithOfficialApi,
  defaultSlaHours,
  computeDueAt,
} from "./official.js";
import { getSlaHoursForAgency } from "../governance/service.js";

export function createPersistedAdapters() {
  const memory = [];
  const adapters = createMemoryAdapters(memory);
  const wrapped = {};
  for (const [agencyId, adapter] of Object.entries(adapters)) {
    wrapped[agencyId] = {
      async submit(caseDoc) {
        const result = await adapter.submit(caseDoc);
        const now = new Date();
        const slaHours =
          (await getSlaHoursForAgency(agencyId)) || defaultSlaHours(agencyId);
        const dueAt = computeDueAt(now, slaHours);

        const sync = await registerWithOfficialApi(
          agencyId,
          caseDoc,
          result.externalRef
        );

        await MockTicket.create({
          ...result.raw,
          status: "received",
          dueAt,
          statusHistory: [
            {
              status: "received",
              note: "Diterima dari saluran bersatu",
              at: now,
            },
          ],
          externalSync: sync.attempted
            ? {
                status: sync.ok ? "registered" : "failed",
                externalId: sync.externalId || null,
                lastAttemptAt: now,
                lastError: sync.ok ? null : sync.error || sync.reason || null,
              }
            : { status: null },
        });
        return result;
      },
    };
  }
  return wrapped;
}
