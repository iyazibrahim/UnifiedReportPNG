export function createGateway(adapters) {
  return {
    async dispatch(caseDoc) {
      if (!caseDoc?.location?.confirmed) {
        throw new Error("Cannot dispatch until location is confirmed");
      }
      const agencyId = caseDoc.jurisdiction?.agencyId;
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
