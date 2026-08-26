import { classifyByKeywords } from "./keywords.js";
import { classifyWithLlm } from "./llm.js";

export async function classifyReport(text, llmOptions = {}) {
  try {
    const llm = await classifyWithLlm(text, llmOptions);
    if (llm && llm.categoryId !== "lain_lain") return llm;
    if (llm && llm.confidence >= 0.6) return llm;
  } catch {
    // fall through to keywords
  }
  return classifyByKeywords(text);
}
