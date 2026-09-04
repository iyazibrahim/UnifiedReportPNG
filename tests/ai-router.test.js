import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { completeWithFailover } from "../src/ai/router.js";
import { parseJsonFromContent } from "../src/ai/openRouter.js";
import { cosineSimilarity, chunkText } from "../src/ai/embeddings.js";
import { anonymizeText } from "../src/ai/ingest.js";
import { formatRetrievedContext } from "../src/ai/retrieve.js";
import { isGenericPlaceName } from "../src/location/learnPlace.js";

describe("parseJsonFromContent", () => {
  it("extracts JSON object from prose", () => {
    const r = parseJsonFromContent('Here: {"a":1,"b":"x"} done');
    assert.equal(r.ok, true);
    assert.equal(r.value.a, 1);
  });

  it("fails without braces", () => {
    const r = parseJsonFromContent("no json");
    assert.equal(r.ok, false);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    assert.ok(Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 1e-9);
  });

  it("returns 0 for orthogonal vectors", () => {
    assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    assert.deepEqual(chunkText("hello"), ["hello"]);
  });

  it("splits long text", () => {
    const long = "a".repeat(5000);
    const chunks = chunkText(long, { maxChars: 2000, overlapChars: 100 });
    assert.ok(chunks.length >= 2);
  });
});

describe("anonymizeText", () => {
  it("strips phone-like strings", () => {
    const out = anonymizeText("Call 012-345 6789 about sampah");
    assert.match(out, /\[phone\]/);
    assert.match(out, /sampah/);
  });
});

describe("formatRetrievedContext", () => {
  it("formats chunks for prompts", () => {
    const text = formatRetrievedContext([
      {
        text: "tong sampah penuh",
        sourceType: "case",
        metadata: { categoryId: "kebersihan" },
        score: 0.9,
      },
    ]);
    assert.match(text, /kebersihan/);
    assert.match(text, /tong sampah/);
  });
});

describe("isGenericPlaceName", () => {
  it("rejects generic road labels", () => {
    assert.equal(isGenericPlaceName("road"), true);
    assert.equal(isGenericPlaceName("residential"), true);
    assert.equal(isGenericPlaceName("TF Mart Balik Pulau"), false);
  });
});

describe("completeWithFailover", () => {
  it("uses primary when confidence is high", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"ok":true,"confidence":0.9,"value":1}',
              },
            },
          ],
        }),
      };
    };
    const result = await completeWithFailover({
      task: "landmark",
      apiKey: "test-key",
      primaryModel: "primary/model",
      strongModel: "strong/model",
      fetchImpl,
      messages: [{ role: "user", content: "x" }],
      validate: (p) => ({ ok: Boolean(p.ok), confidence: p.confidence }),
    });
    assert.equal(result.switched, false);
    assert.equal(result.modelUsed, "primary/model");
    assert.equal(calls, 1);
  });

  it("switches to strong on HTTP failure", async () => {
    let calls = 0;
    const fetchImpl = async (_url, opts) => {
      calls += 1;
      const body = JSON.parse(opts.body);
      if (body.model === "primary/model") {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"ok":true,"confidence":0.95}',
              },
            },
          ],
        }),
      };
    };
    const result = await completeWithFailover({
      task: "classify",
      apiKey: "test-key",
      primaryModel: "primary/model",
      strongModel: "strong/model",
      fetchImpl,
      messages: [{ role: "user", content: "x" }],
      validate: (p) => ({
        ok: Boolean(p.ok),
        confidence: Number(p.confidence) || 0.5,
      }),
    });
    assert.equal(result.switched, true);
    assert.equal(result.modelUsed, "strong/model");
    assert.equal(calls, 2);
  });

  it("switches on low confidence", async () => {
    let calls = 0;
    const fetchImpl = async (_url, opts) => {
      calls += 1;
      const body = JSON.parse(opts.body);
      const conf = body.model === "primary/model" ? 0.2 : 0.85;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `{"ok":true,"confidence":${conf}}`,
              },
            },
          ],
        }),
      };
    };
    const result = await completeWithFailover({
      task: "classify",
      apiKey: "test-key",
      primaryModel: "primary/model",
      strongModel: "strong/model",
      fetchImpl,
      messages: [{ role: "user", content: "x" }],
      validate: (p) => ({
        ok: true,
        confidence: Number(p.confidence) || 0,
      }),
    });
    assert.equal(result.switched, true);
    assert.equal(result.modelUsed, "strong/model");
    assert.ok(result.confidence >= 0.8);
    assert.equal(calls, 2);
  });
});
