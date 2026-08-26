import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyWithLlm } from "../src/classify/llm.js";
import { classifyReport } from "../src/classify/classify.js";

describe("classifyWithLlm", () => {
  it("parses a valid OpenRouter JSON reply", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"categoryId":"pokok","confidence":0.88}',
            },
          },
        ],
      }),
    });
    const result = await classifyWithLlm("pokok tumbang", {
      apiKey: "test",
      fetchImpl,
    });
    assert.equal(result.categoryId, "pokok");
    assert.equal(result.method, "llm");
    assert.equal(result.confidence, 0.88);
  });

  it("returns null without an API key", async () => {
    const result = await classifyWithLlm("sampah", { apiKey: "" });
    assert.equal(result, null);
  });
});

describe("classifyReport", () => {
  it("falls back to keywords when LLM is unavailable", async () => {
    const result = await classifyReport("Tong sampah penuh", { apiKey: "" });
    assert.equal(result.categoryId, "kebersihan");
    assert.equal(result.method, "rules");
  });
});
