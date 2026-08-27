import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  defaultToggles,
} from "../src/settings/service.js";

describe("settings crypto", () => {
  it("encrypts and decrypts secrets", () => {
    const env = { JWT_SECRET: "test-secret-key" };
    const enc = encryptSecret("sk-openrouter-abc123", env);
    assert.match(enc, /^enc:/);
    assert.equal(decryptSecret(enc, env), "sk-openrouter-abc123");
  });

  it("masks secrets with last4 hint", () => {
    const masked = maskSecret("abcdefghij");
    assert.equal(masked.configured, true);
    assert.equal(masked.hint, "••••ghij");
  });

  it("reports unconfigured when empty", () => {
    assert.deepEqual(maskSecret(""), {
      configured: false,
      hint: null,
    });
  });
});

describe("defaultToggles", () => {
  it("enables all agencies by default", () => {
    const t = defaultToggles();
    assert.equal(t.mockDispatchEnabled, true);
    assert.equal(t.pearl_mbpp, true);
    assert.equal(t.epintas, true);
    assert.equal(t.abuseGuardsEnabled, true);
  });
});
