import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createToken, verifyToken, loginAdmin } from "../src/admin/auth.js";

describe("admin auth", () => {
  const secret = "test-jwt-secret-long-enough";

  it("creates and verifies a token", () => {
    const token = createToken({ sub: "ops" }, secret, 60);
    const claims = verifyToken(token, secret);
    assert.equal(claims.sub, "ops");
  });

  it("rejects bad tokens", () => {
    assert.equal(verifyToken("a.b.c", secret), null);
  });

  it("logs in with ops credentials from env fallback", async () => {
    const token = await loginAdmin("ops", "changeme", {
      opsUser: "ops",
      opsPassword: "changeme",
      jwtSecret: secret,
    });
    assert.ok(token);
    assert.equal(verifyToken(token, secret).sub, "ops");
  });

  it("rejects bad password", async () => {
    assert.equal(
      await loginAdmin("ops", "wrong", {
        opsUser: "ops",
        opsPassword: "changeme",
        jwtSecret: secret,
      }),
      null
    );
  });
});
