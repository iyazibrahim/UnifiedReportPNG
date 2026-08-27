import { resolveToggle } from "../settings/service.js";

export function createGateway(adapters) {
  return {
    async dispatch(caseDoc) {
      if (!caseDoc?.location?.confirmed) {
        throw new Error("Cannot dispatch until location is confirmed");
      }
      if (!(await resolveToggle("mockDispatchEnabled"))) {
        throw new Error("Agency dispatch is disabled in Settings");
      }
      const agencyId = caseDoc.jurisdiction?.agencyId;
      if (!(await resolveToggle(agencyId))) {
        throw new Error(
          `Dispatch to ${agencyId} is disabled in Settings`
        );
      }
      const adapter = adapters[agencyId];
      if (!adapter) {
        throw new Error(`No adapter for agency ${agencyId}`);
      }
      const result = await adapter.submit(caseDoc);
      return {
        adapterId: agencyId,
        status: "dispatched",
        externalRef: result.externalRef,
        requestPayload: result.raw?.payload ?? null,
        responsePayload: result.raw ?? result,
        dispatchedAt: new Date().toISOString(),
      };
    },
  };
}
