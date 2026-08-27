import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGateway } from "../src/adapters/gateway.js";
import { createMemoryAdapters } from "../src/adapters/mocks.js";
import { toDispatchPayload } from "../src/cases/payload.js";

describe("agency gateway", () => {
  it("dispatches to the mock Pearl adapter and returns an external ref", async () => {
    const store = [];
    const gateway = createGateway(createMemoryAdapters(store));
    const caseDoc = {
      ref: "PG-20260826-A3K9",
      channel: "telegram",
      reporter: { telegramUserId: "1", displayName: "Ali" },
      intake: { text: "sampah", photoFileIds: [], language: "ms" },
      location: {
        lat: 5.4141,
        lng: 100.3288,
        accuracy_m: 10,
        source: "telegram_picked",
        confirmed: true,
        confirmed_at: "2026-08-26T00:00:00Z",
        display_name: "George Town",
        road: "Jalan Penang",
        landmark: null,
        address_override: null,
      },
      classification: {
        categoryId: "kebersihan",
        categoryLabel: "Kebersihan",
        confidence: 0.9,
        method: "rules",
      },
      jurisdiction: {
        agencyId: "pearl_mbpp",
        agencyLabel: "Pearl eAduan (MBPP)",
        reason: "Pulau + kebersihan",
        confidence: "high",
        needsTriage: false,
      },
    };

    const result = await gateway.dispatch(caseDoc);
    assert.equal(result.externalRef, "PEARL-20260826-A3K9");
    assert.equal(store.length, 1);
    assert.equal(store[0].payload.location.lat, 5.4141);
    assert.equal(store[0].payload.location.display_name, "George Town");
  });

  it("does not recycle ticket numbers across different cases", async () => {
    const store = [];
    const gateway = createGateway(createMemoryAdapters(store));
    const base = {
      channel: "telegram",
      reporter: { telegramUserId: "1", displayName: "Ali" },
      intake: { text: "sampah", photoFileIds: [], language: "ms" },
      location: {
        lat: 5.4141,
        lng: 100.3288,
        accuracy_m: 10,
        source: "telegram_picked",
        confirmed: true,
        confirmed_at: "2026-08-26T00:00:00Z",
        display_name: "George Town",
        road: "Jalan Penang",
        landmark: null,
        address_override: null,
      },
      classification: {
        categoryId: "kebersihan",
        categoryLabel: "Kebersihan",
        confidence: 0.9,
        method: "rules",
      },
      jurisdiction: {
        agencyId: "pearl_mbpp",
        agencyLabel: "Pearl eAduan (MBPP)",
        reason: "Pulau + kebersihan",
        confidence: "high",
        needsTriage: false,
      },
    };
    const a = await gateway.dispatch({ ...base, ref: "PG-20260827-AAAA" });
    const b = await gateway.dispatch({ ...base, ref: "PG-20260827-BBBB" });
    assert.equal(a.externalRef, "PEARL-20260827-AAAA");
    assert.equal(b.externalRef, "PEARL-20260827-BBBB");
    assert.notEqual(a.externalRef, b.externalRef);
  });

  it("refuses dispatch when location is not confirmed", async () => {
    const gateway = createGateway(createMemoryAdapters([]));
    await assert.rejects(
      () =>
        gateway.dispatch({
          location: { confirmed: false },
          jurisdiction: { agencyId: "pearl_mbpp" },
        }),
      /confirmed/
    );
  });

  it("keeps location truth/confirm/label split in the dispatch payload", () => {
    const payload = toDispatchPayload({
      ref: "PG-1",
      channel: "telegram",
      reporter: {},
      intake: {},
      location: {
        lat: 5.4,
        lng: 100.3,
        accuracy_m: 8,
        source: "telegram_current",
        confirmed: true,
        confirmed_at: "t",
        display_name: "label",
        road: "road",
        landmark: "kedai",
        address_override: null,
      },
      classification: {},
      jurisdiction: {},
    });
    assert.equal(payload.location.lat, 5.4);
    assert.equal(payload.location.confirmed, true);
    assert.equal(payload.location.landmark, "kedai");
    assert.equal(payload.location.override, null);
  });
});
