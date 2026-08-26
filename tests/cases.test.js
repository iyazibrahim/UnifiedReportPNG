import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { saveDispatchedCase } from "../src/cases/service.js";

describe("saveDispatchedCase", () => {
  it("stores the same ref used at dispatch", async () => {
    const created = [];
    const CaseModel = {
      create: async (doc) => {
        created.push(doc);
        return doc;
      },
    };
    const doc = await saveDispatchedCase({
      CaseModel,
      ref: "PG-20260826-TEST",
      reporter: { telegramUserId: "1", displayName: "Ali" },
      draft: {
        text: "sampah",
        photoFileIds: [],
        location: { lat: 5.4, lng: 100.3, confirmed: true },
        classification: { categoryId: "kebersihan" },
        jurisdiction: { agencyId: "pearl_mbpp", needsTriage: false },
      },
      dispatch: { externalRef: "PEARL-0001", adapterId: "pearl_mbpp" },
    });
    assert.equal(doc.ref, "PG-20260826-TEST");
    assert.equal(created[0].status, "dispatched");
  });
});
