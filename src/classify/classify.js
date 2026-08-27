import { classifyByKeywords } from "./keywords.js";
import { classifyWithLlm } from "./llm.js";
import {
  resolveSecret,
  resolveConfig,
  resolveToggle,
} from "../settings/service.js";

export async function classifyReport(text, llmOptions = {}) {
  const llmEnabled = await resolveToggle("llmClassificationEnabled");
  const keywordEnabled = await resolveToggle("keywordFallbackEnabled");

  if (llmEnabled) {
    try {
      const key =
        llmOptions.apiKey ||
        (await resolveSecret("openRouterApiKey")).value;
      const model =
        llmOptions.model ||
        (await resolveConfig("openRouterModel", process.env, "openai/gpt-4o-mini"))
          .value;
      const llm = await classifyWithLlm(text, {
        ...llmOptions,
        apiKey: key,
        model,
      });
      if (llm && llm.categoryId !== "lain_lain") return llm;
      if (llm && llm.confidence >= 0.6) return llm;
    } catch {
      // fall through
    }
  }

  if (keywordEnabled) {
    return classifyByKeywords(text);
  }

  return {
    categoryId: "lain_lain",
    categoryLabel: "Lain-lain / tidak pasti",
    confidence: 0.1,
    method: "rules",
  };
}
