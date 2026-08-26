import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderOpsPage } from "../src/ops/page.js";

describe("renderOpsPage", () => {
  it("includes case ref, agency reason, and map link", () => {
    const html = renderOpsPage([
      {
        ref: "PG-20260826-A3K9",
        classification: { categoryLabel: "Kebersihan / sampah", categoryId: "kebersihan" },
        jurisdiction: {
          agencyLabel: "Pearl eAduan (MBPP)",
          reason: "Pin di Pulau Pinang",
        },
        location: { lat: 5.4141, lng: 100.3288, confirmed: true },
        status: "dispatched",
        dispatch: { externalRef: "PEARL-0001" },
        channel: "telegram",
        reporter: {},
        intake: {},
      },
    ]);
    assert.match(html, /PG-20260826-A3K9/);
    assert.match(html, /Pearl eAduan/);
    assert.match(html, /maps\?q=5\.4141,100\.3288/);
    assert.match(html, /PEARL-0001/);
  });
});
