import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MOCK_TICKET_STATUSES,
  STATUS_LABEL,
} from "../src/models/MockTicket.js";

describe("agency ticket statuses", () => {
  it("covers the workflow labels including acknowledged", () => {
    assert.deepEqual(MOCK_TICKET_STATUSES, [
      "received",
      "acknowledged",
      "in_progress",
      "resolved",
      "rejected",
    ]);
    assert.equal(STATUS_LABEL.received, "Diterima");
    assert.equal(STATUS_LABEL.acknowledged, "Diakui");
    assert.equal(STATUS_LABEL.in_progress, "Dalam tindakan");
    assert.equal(STATUS_LABEL.resolved, "Selesai");
    assert.equal(STATUS_LABEL.rejected, "Ditolak");
  });
});
