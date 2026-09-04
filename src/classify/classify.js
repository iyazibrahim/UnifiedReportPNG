import { classifyByKeywords } from "./keywords.js";
import { classifyWithLlm } from "./llm.js";
import {
  resolveSecret,
  resolveConfig,
  resolveToggle,
} from "../settings/service.js";
import { retrieveKnowledge } from "../ai/retrieve.js";
import { CATEGORIES } from "../jurisdiction/categories.js";

const CLARIFY_THRESHOLD = 0.55;

export async function classifyReport(text, llmOptions = {}) {
  const llmEnabled = await resolveToggle("llmClassificationEnabled");
  const keywordEnabled = await resolveToggle("keywordFallbackEnabled");

  let retrievedChunks = llmOptions.retrievedChunks;
  if (retrievedChunks === undefined && (await resolveToggle("ragEnabled"))) {
    try {
      const key =
        llmOptions.apiKey ||
        (await resolveSecret("openRouterApiKey")).value;
      retrievedChunks = await retrieveKnowledge(text, {
        apiKey: key,
        fetchImpl: llmOptions.fetchImpl,
      });
    } catch {
      retrievedChunks = [];
    }
  }

  if (llmEnabled) {
    try {
      const key =
        llmOptions.apiKey ||
        (await resolveSecret("openRouterApiKey")).value;
      const model =
        llmOptions.model ||
        (
          await resolveConfig("aiPrimaryModel", process.env, "")
        ).value ||
        (
          await resolveConfig(
            "openRouterModel",
            process.env,
            "openai/gpt-4o-mini"
          )
        ).value;
      const strongModel =
        llmOptions.strongModel ||
        (
          await resolveConfig("aiStrongModel", process.env, "openai/gpt-4o")
        ).value;
      const llm = await classifyWithLlm(text, {
        ...llmOptions,
        apiKey: key,
        model,
        strongModel,
        retrievedChunks,
      });
      if (llm) {
        const needsClarify =
          llm.categoryId === "lain_lain" ||
          llm.confidence < CLARIFY_THRESHOLD;
        return {
          ...llm,
          needsClarify,
          retrievedCount: retrievedChunks?.length || 0,
        };
      }
    } catch {
      // fall through
    }
  }

  if (keywordEnabled) {
    const rules = classifyByKeywords(text);
    const needsClarify =
      rules.categoryId === "lain_lain" ||
      (rules.confidence || 0) < CLARIFY_THRESHOLD;
    return { ...rules, needsClarify, retrievedCount: retrievedChunks?.length || 0 };
  }

  return {
    categoryId: "lain_lain",
    categoryLabel: CATEGORIES.lain_lain.label,
    confidence: 0.1,
    method: "rules",
    needsClarify: true,
    candidates: ["lain_lain"],
    retrievedCount: retrievedChunks?.length || 0,
  };
}
