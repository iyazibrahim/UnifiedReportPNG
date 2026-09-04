/**
 * Task-aware model router: primary → strong on failure / low confidence.
 */
import { chatCompletions, parseJsonFromContent } from "./openRouter.js";
import {
  resolveConfig,
  resolveSecret,
} from "../settings/service.js";

export const DEFAULT_PRIMARY = "openai/gpt-4o-mini";
export const DEFAULT_STRONG = "openai/gpt-4o";
export const DEFAULT_EMBEDDING = "openai/text-embedding-3-small";

const CONFIDENCE_THRESHOLDS = {
  classify: 0.6,
  landmark: 0.5,
  street: 0.5,
};

/**
 * Resolve OpenRouter models from Settings / env.
 * Falls back to legacy openRouterModel for primary.
 */
export async function resolveAiModels(env = process.env) {
  const primary =
    (
      await resolveConfig("aiPrimaryModel", env, "")
    ).value ||
    (
      await resolveConfig("openRouterModel", env, DEFAULT_PRIMARY)
    ).value ||
    DEFAULT_PRIMARY;
  const strong =
    (await resolveConfig("aiStrongModel", env, DEFAULT_STRONG)).value ||
    DEFAULT_STRONG;
  const embedding =
    (await resolveConfig("aiEmbeddingModel", env, DEFAULT_EMBEDDING)).value ||
    DEFAULT_EMBEDDING;
  return { primary, strong, embedding };
}

export async function resolveOpenRouterKey(env = process.env) {
  return (await resolveSecret("openRouterApiKey", env)).value || "";
}

/**
 * @param {object} opts
 * @param {string} opts.task - classify | landmark | street | staff_chat
 * @param {Array} opts.messages
 * @param {string} [opts.apiKey]
 * @param {string} [opts.primaryModel]
 * @param {string} [opts.strongModel]
 * @param {function} [opts.fetchImpl]
 * @param {number} [opts.temperature]
 * @param {function} [opts.validate] - (parsed) => { ok, confidence?, reason? }
 * @returns {Promise<{ ok, parsed, content, modelUsed, switched, switchReason, confidence }>}
 */
export async function completeWithFailover({
  task,
  messages,
  apiKey,
  primaryModel,
  strongModel,
  fetchImpl,
  temperature = 0,
  validate,
} = {}) {
  const models = await resolveAiModels();
  const key = apiKey || (await resolveOpenRouterKey());
  const primary = primaryModel || models.primary;
  const strong = strongModel || models.strong;
  const threshold = CONFIDENCE_THRESHOLDS[task] ?? 0.6;

  if (!key) {
    return {
      ok: false,
      parsed: null,
      content: null,
      modelUsed: null,
      switched: false,
      switchReason: "missing_api_key",
      confidence: 0,
    };
  }

  async function attempt(model, switchReason) {
    const res = await chatCompletions({
      apiKey: key,
      model,
      messages,
      temperature,
      fetchImpl,
    });
    if (!res.ok) {
      return {
        ok: false,
        parsed: null,
        content: null,
        modelUsed: model,
        switched: Boolean(switchReason),
        switchReason: switchReason || res.error || "http_error",
        confidence: 0,
        httpFailed: true,
      };
    }
    const parsed = parseJsonFromContent(res.content);
    if (!parsed.ok) {
      return {
        ok: false,
        parsed: null,
        content: res.content,
        modelUsed: model,
        switched: Boolean(switchReason),
        switchReason: switchReason || parsed.error || "invalid_json",
        confidence: 0,
        parseFailed: true,
      };
    }
    let confidence = Number(parsed.value?.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));

    if (typeof validate === "function") {
      const v = validate(parsed.value);
      if (!v?.ok) {
        return {
          ok: false,
          parsed: parsed.value,
          content: res.content,
          modelUsed: model,
          switched: Boolean(switchReason),
          switchReason: switchReason || v?.reason || "validation_failed",
          confidence: Number.isFinite(v?.confidence) ? v.confidence : confidence,
          validationFailed: true,
        };
      }
      if (Number.isFinite(v.confidence)) confidence = v.confidence;
    }

    const lowConfidence = confidence < threshold;
    return {
      ok: !lowConfidence,
      parsed: parsed.value,
      content: res.content,
      modelUsed: model,
      switched: Boolean(switchReason),
      switchReason: lowConfidence
        ? switchReason || "low_confidence"
        : switchReason || null,
      confidence,
      lowConfidence,
    };
  }

  let first = await attempt(primary, null);
  if (first.ok && !first.lowConfidence) {
    return {
      ok: true,
      parsed: first.parsed,
      content: first.content,
      modelUsed: first.modelUsed,
      switched: false,
      switchReason: null,
      confidence: first.confidence,
    };
  }

  // Same model id → no point retrying
  if (strong === primary) {
    return {
      ok: Boolean(first.parsed),
      parsed: first.parsed,
      content: first.content,
      modelUsed: first.modelUsed,
      switched: false,
      switchReason: first.switchReason,
      confidence: first.confidence,
    };
  }

  const reason =
    first.httpFailed || first.parseFailed || first.validationFailed
      ? first.switchReason
      : "low_confidence";
  const second = await attempt(strong, reason);
  return {
    ok: Boolean(second.parsed) && !second.httpFailed && !second.parseFailed,
    parsed: second.parsed ?? first.parsed,
    content: second.content ?? first.content,
    modelUsed: second.modelUsed,
    switched: true,
    switchReason: reason,
    confidence: second.confidence ?? first.confidence,
  };
}
