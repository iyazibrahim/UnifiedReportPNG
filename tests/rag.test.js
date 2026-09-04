import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity } from "../src/ai/embeddings.js";
import { formatRetrievedContext, placeHintsFromChunks } from "../src/ai/retrieve.js";
import { anonymizeText } from "../src/ai/ingest.js";
import { classifyWithLlm } from "../src/classify/llm.js";
import { categoryClarifyButtons } from "../src/intake/buttons.js";

describe("RAG helpers", () => {
  it("ranks similar vectors higher", () => {
    const q = [1, 0.1, 0];
    const near = [0.9, 0.2, 0];
    const far = [0, 0, 1];
    assert.ok(cosineSimilarity(q, near) > cosineSimilarity(q, far));
  });

  it("placeHintsFromChunks extracts hints", () => {
    const hints = placeHintsFromChunks([
      { text: "sampah depan Lotus Bertam · Category: kebersihan" },
    ]);
    assert.ok(hints.length >= 1);
  });

  it("anonymize strips long digit ids", () => {
    assert.match(anonymizeText("ref 1234567890"), /\[phone\]|\[id\]/);
  });
});

describe("classifyWithLlm + retrieved context", () => {
  it("includes retrieved snippets in the system prompt", async () => {
    let systemPrompt = "";
    const fetchImpl = async (_url, opts) => {
      const body = JSON.parse(opts.body);
      systemPrompt = body.messages[0].content;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"categoryId":"kebersihan","confidence":0.91,"candidates":["kebersihan"]}',
              },
            },
          ],
        }),
      };
    };
    const result = await classifyWithLlm("tong penuh", {
      apiKey: "test",
      model: "primary/m",
      strongModel: "primary/m",
      fetchImpl,
      retrievedChunks: [
        {
          text: "tong sampah penuh · Category: kebersihan",
          sourceType: "case",
          metadata: { categoryId: "kebersihan" },
          score: 0.88,
        },
      ],
    });
    assert.equal(result.categoryId, "kebersihan");
    assert.match(systemPrompt, /tong sampah penuh/);
    assert.equal(result.modelUsed, "primary/m");
  });
});

describe("categoryClarifyButtons", () => {
  it("builds buttons with category labels", () => {
    const buttons = categoryClarifyButtons(["kebersihan", "jalan"]);
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].id, "cat_pick_kebersihan");
    assert.match(buttons[0].label, /Kebersihan/i);
  });
});
