import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MOCK_TICKET_STATUSES } from "../src/models/MockTicket.js";
import { STATUS_LABEL } from "../src/mock/routes.js";

describe("mock ticket statuses", () => {
  it("covers the demo workflow labels", () => {
    assert.deepEqual(MOCK_TICKET_STATUSES, [
      "received",
      "in_progress",
      "resolved",
      "rejected",
    ]);
    assert.equal(STATUS_LABEL.received, "Diterima");
    assert.equal(STATUS_LABEL.in_progress, "Dalam tindakan");
    assert.equal(STATUS_LABEL.resolved, "Selesai");
    assert.equal(STATUS_LABEL.rejected, "Ditolak");
  });
});
