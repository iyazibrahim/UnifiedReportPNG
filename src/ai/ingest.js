/**
 * Anonymized RAG ingest: cases, corrections, SOP docs.
 */
import { KnowledgeChunk } from "../models/KnowledgeChunk.js";
import { KnowledgeDoc } from "../models/KnowledgeDoc.js";
import { chunkText, embedText, embedTexts } from "./embeddings.js";
import { resolveToggle } from "../settings/service.js";

/** Strip phones and long digit runs (PDPA). */
export function anonymizeText(text) {
  return String(text || "")
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, "[phone]")
    .replace(/\b\d{8,}\b/g, "[id]")
    .replace(/\s+/g, " ")
    .trim();
}

function caseChunkText({ text, categoryId, agencyId, daerah }) {
  const parts = [
    `Citizen report: ${anonymizeText(text)}`,
    categoryId ? `Category: ${categoryId}` : null,
    agencyId ? `Agency: ${agencyId}` : null,
    daerah ? `Daerah: ${daerah}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function ingestCaseKnowledge(caseDoc, { fetchImpl } = {}) {
  try {
    if (!(await resolveToggle("ragEnabled"))) return null;
    const text = caseDoc?.intake?.text;
    if (!text) return null;
    const categoryId = caseDoc.classification?.categoryId || null;
    const agencyId = caseDoc.jurisdiction?.agencyId || null;
    const daerah = caseDoc.location?.daerah || null;
    const chunkBody = caseChunkText({ text, categoryId, agencyId, daerah });
    const embedding = await embedText(chunkBody, { fetchImpl });
    if (!embedding) return null;
    return KnowledgeChunk.create({
      sourceType: "case",
      sourceId: caseDoc.ref || String(caseDoc._id || ""),
      text: chunkBody,
      embedding,
      metadata: { categoryId, agencyId, daerah },
    });
  } catch {
    return null;
  }
}

export async function ingestCorrection({
  caseRef,
  text,
  categoryId,
  agencyId,
  daerah,
  note,
  fetchImpl,
} = {}) {
  try {
    if (!(await resolveToggle("ragEnabled"))) return null;
    const body = [
      `Correction: ${anonymizeText(text || "")}`,
      categoryId ? `Correct category: ${categoryId}` : null,
      agencyId ? `Correct agency: ${agencyId}` : null,
      daerah ? `Daerah: ${daerah}` : null,
      note ? `Note: ${note}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (!body || body === "Correction:") return null;
    const embedding = await embedText(body, { fetchImpl });
    if (!embedding) return null;
    return KnowledgeChunk.create({
      sourceType: "correction",
      sourceId: caseRef || null,
      text: body,
      embedding,
      metadata: { categoryId, agencyId, daerah },
    });
  } catch {
    return null;
  }
}

export async function ingestKnowledgeDoc(doc, { fetchImpl } = {}) {
  const chunks = chunkText(doc.body);
  if (!chunks.length) return [];
  const embeddings = await embedTexts(chunks, { fetchImpl });
  const sourceType = doc.docType === "faq" ? "faq" : "sop";
  const created = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    if (!embedding) continue;
    const row = await KnowledgeChunk.create({
      sourceType,
      sourceId: String(doc._id),
      text: chunks[i],
      embedding,
      metadata: {
        agencyId: doc.agencyId || null,
        title: doc.title,
      },
    });
    created.push(row);
  }
  return created;
}

export async function createAndIngestKnowledgeDoc(
  { title, body, agencyId, docType, createdBy },
  { fetchImpl } = {}
) {
  const doc = await KnowledgeDoc.create({
    title: String(title || "Untitled").slice(0, 200),
    body: String(body || ""),
    agencyId: agencyId || null,
    docType: docType || "sop",
    createdBy: createdBy || null,
    active: true,
  });
  const chunks = await ingestKnowledgeDoc(doc, { fetchImpl });
  return { doc, chunks };
}

export async function deactivateChunksForDoc(docId) {
  await KnowledgeChunk.updateMany(
    { sourceId: String(docId), sourceType: { $in: ["sop", "faq"] } },
    { $set: { active: false } }
  );
}
