/**
 * Embedding helpers + cosine similarity for in-process RAG.
 */
import { embed } from "./openRouter.js";
import {
  resolveAiModels,
  resolveOpenRouterKey,
} from "./router.js";

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embedText(text, { apiKey, model, fetchImpl } = {}) {
  const models = await resolveAiModels();
  const key = apiKey || (await resolveOpenRouterKey());
  const embModel = model || models.embedding;
  const result = await embed({
    apiKey: key,
    model: embModel,
    input: String(text || "").slice(0, 8000),
    fetchImpl,
  });
  if (!result.ok || !result.embedding) return null;
  return result.embedding;
}

export async function embedTexts(texts, { apiKey, model, fetchImpl } = {}) {
  const models = await resolveAiModels();
  const key = apiKey || (await resolveOpenRouterKey());
  const embModel = model || models.embedding;
  const cleaned = (texts || []).map((t) => String(t || "").slice(0, 8000));
  if (!cleaned.length) return [];
  const result = await embed({
    apiKey: key,
    model: embModel,
    input: cleaned,
    fetchImpl,
  });
  if (!result.ok) return cleaned.map(() => null);
  return result.embeddings || [];
}

/** Rough char-based chunker (~4 chars ≈ 1 token). */
export function chunkText(text, { maxChars = 2000, overlapChars = 320 } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  if (raw.length <= maxChars) return [raw];
  const chunks = [];
  let start = 0;
  while (start < raw.length) {
    let end = Math.min(start + maxChars, raw.length);
    if (end < raw.length) {
      const slice = raw.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n")
      );
      if (breakAt > maxChars * 0.4) end = start + breakAt + 1;
    }
    chunks.push(raw.slice(start, end).trim());
    if (end >= raw.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks.filter(Boolean);
}
