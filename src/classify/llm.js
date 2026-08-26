import { CATEGORY_IDS, CATEGORIES } from "../jurisdiction/categories.js";

const SYSTEM = `You classify Penang citizen reports into exactly one category id.
Return JSON only: {"categoryId":"<id>","confidence":0.0}
Valid categoryId values: ${CATEGORY_IDS.join(", ")}
confidence is 0 to 1. If unsure use lain_lain with low confidence.
Do not decide which agency owns the issue.`;

export async function classifyWithLlm(text, { apiKey, model, fetchImpl } = {}) {
  if (!apiKey) return null;
  const fetchFn = fetchImpl || fetch;
  const res = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "openai/gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: String(text || "").slice(0, 2000) },
      ],
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) return null;
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
  const categoryId = CATEGORIES[parsed.categoryId]
    ? parsed.categoryId
    : "lain_lain";
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5));
  return {
    categoryId,
    categoryLabel: CATEGORIES[categoryId].label,
    confidence,
    method: "llm",
  };
}
