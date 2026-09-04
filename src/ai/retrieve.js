/**
 * Retrieve top-k knowledge chunks by cosine similarity.
 */
import { KnowledgeChunk } from "../models/KnowledgeChunk.js";
import { cosineSimilarity, embedText } from "./embeddings.js";
import { resolveToggle } from "../settings/service.js";

const CASE_CAP = 400;
const SOP_CAP = 200;

/**
 * @returns {Promise<Array<{ text, score, sourceType, metadata }>>}
 */
export async function retrieveKnowledge(query, {
  topK = 5,
  apiKey,
  fetchImpl,
  categoryHint,
} = {}) {
  if (!(await resolveToggle("ragEnabled"))) return [];
  const q = String(query || "").trim();
  if (!q) return [];

  const queryEmbedding = await embedText(q, { apiKey, fetchImpl });
  if (!queryEmbedding) return [];

  const sopFilter = {
    active: { $ne: false },
    sourceType: { $in: ["sop", "faq"] },
  };
  const caseFilter = {
    active: { $ne: false },
    sourceType: { $in: ["case", "correction"] },
  };
  if (categoryHint) {
    caseFilter["metadata.categoryId"] = categoryHint;
  }

  let sopChunks = [];
  let caseChunks = [];
  try {
    sopChunks = await KnowledgeChunk.find(sopFilter)
      .sort({ createdAt: -1 })
      .limit(SOP_CAP)
      .lean();
    // If category filter yields too few, also load recent unfiltered cases
    caseChunks = await KnowledgeChunk.find(caseFilter)
      .sort({ createdAt: -1 })
      .limit(CASE_CAP)
      .lean();
    if (categoryHint && caseChunks.length < 20) {
      const extra = await KnowledgeChunk.find({
        active: { $ne: false },
        sourceType: { $in: ["case", "correction"] },
      })
        .sort({ createdAt: -1 })
        .limit(CASE_CAP)
        .lean();
      const seen = new Set(caseChunks.map((c) => String(c._id)));
      for (const c of extra) {
        if (!seen.has(String(c._id))) caseChunks.push(c);
      }
    }
  } catch {
    return [];
  }

  const pool = [...sopChunks, ...caseChunks].filter(
    (c) => Array.isArray(c.embedding) && c.embedding.length
  );

  const scored = pool
    .map((c) => ({
      text: c.text,
      sourceType: c.sourceType,
      metadata: c.metadata || {},
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .filter((c) => c.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/** Format retrieved chunks for LLM system/user prompt injection. */
export function formatRetrievedContext(chunks) {
  if (!chunks?.length) return "";
  const lines = chunks.map((c, i) => {
    const meta = [
      c.sourceType,
      c.metadata?.categoryId,
      c.metadata?.agencyId,
    ]
      .filter(Boolean)
      .join("/");
    return `${i + 1}. [${meta}] ${c.text}`;
  });
  return [
    "Similar past reports / SOPs (use as grounding; do not invent facts):",
    ...lines,
  ].join("\n");
}

/** Extract place-like alias hints from retrieved chunk text. */
export function placeHintsFromChunks(chunks) {
  const hints = [];
  for (const c of chunks || []) {
    const m = String(c.text || "").match(
      /(?:near|depan|hadapan|at|di)\s+([A-Za-z0-9][A-Za-z0-9\s']{2,40})/i
    );
    if (m?.[1]) hints.push(m[1].trim());
  }
  return [...new Set(hints)].slice(0, 5);
}
