import { CATEGORY_IDS, CATEGORIES } from "../jurisdiction/categories.js";
import { completeWithFailover } from "../ai/router.js";
import {
  formatRetrievedContext,
  retrieveKnowledge,
} from "../ai/retrieve.js";

function buildSystemPrompt(retrievedContext) {
  return `You classify Penang citizen reports into exactly one category id.
Return JSON only: {"categoryId":"<id>","confidence":0.0,"candidates":["id1","id2"]}
Valid categoryId values: ${CATEGORY_IDS.join(", ")}
confidence is 0 to 1. If unsure use lain_lain with low confidence.
Optional candidates: up to 3 plausible category ids (including the chosen one).
Do not decide which agency owns the issue.
${retrievedContext ? `\n${retrievedContext}` : ""}`;
}

function validateClassify(parsed) {
  const categoryId = CATEGORIES[parsed?.categoryId]
    ? parsed.categoryId
    : null;
  if (!categoryId) {
    return { ok: false, reason: "invalid_category", confidence: 0 };
  }
  const confidence = Math.max(
    0,
    Math.min(1, Number(parsed.confidence) || 0.5)
  );
  // Treat lain_lain as needing escalation when confidence not high
  if (categoryId === "lain_lain" && confidence < 0.75) {
    return { ok: false, reason: "lain_lain_low", confidence };
  }
  return { ok: true, confidence };
}

export async function classifyWithLlm(
  text,
  { apiKey, model, strongModel, fetchImpl, retrievedChunks } = {}
) {
  if (!apiKey) return null;
  const context =
    retrievedChunks !== undefined
      ? formatRetrievedContext(retrievedChunks)
      : formatRetrievedContext(
          await retrieveKnowledge(text, { apiKey, fetchImpl })
        );

  const result = await completeWithFailover({
    task: "classify",
    apiKey,
    primaryModel: model,
    strongModel,
    fetchImpl,
    messages: [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: String(text || "").slice(0, 2000) },
    ],
    validate: validateClassify,
  });

  if (!result.parsed) return null;

  const categoryId = CATEGORIES[result.parsed.categoryId]
    ? result.parsed.categoryId
    : "lain_lain";
  const confidence = Math.max(
    0,
    Math.min(1, Number(result.confidence) || Number(result.parsed.confidence) || 0.5)
  );

  const candidates = Array.isArray(result.parsed.candidates)
    ? result.parsed.candidates
        .filter((id) => CATEGORIES[id])
        .slice(0, 3)
    : [];
  if (!candidates.includes(categoryId)) candidates.unshift(categoryId);

  return {
    categoryId,
    categoryLabel: CATEGORIES[categoryId].label,
    confidence,
    method: "llm",
    candidates: [...new Set(candidates)].slice(0, 3),
    modelUsed: result.modelUsed,
    switched: result.switched,
    switchReason: result.switchReason,
  };
}
