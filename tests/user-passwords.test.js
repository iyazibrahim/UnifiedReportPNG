import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/auth/password.js";

describe("password helpers", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("changeme");
    assert.equal(await verifyPassword("changeme", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
  });

  it("produces different hashes for the same password", async () => {
    const a = await hashPassword("samepass1");
    const b = await hashPassword("samepass1");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("samepass1", a), true);
    assert.equal(await verifyPassword("samepass1", b), true);
  });
});
