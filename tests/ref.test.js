import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRef } from "../src/cases/ref.js";

describe("generateRef", () => {
  it("uses PG-YYYYMMDD-XXXX shape", () => {
    const ref = generateRef(new Date("2026-08-26T00:00:00Z"));
    assert.match(ref, /^PG-20260826-[A-Z0-9]{4}$/);
  });

  it("generates distinct suffixes", () => {
    const refs = new Set(Array.from({ length: 20 }, () => generateRef()));
    assert.ok(refs.size >= 18);
  });
});
