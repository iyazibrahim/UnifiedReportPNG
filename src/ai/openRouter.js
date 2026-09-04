/**
 * Shared OpenRouter HTTP client for chat completions and embeddings.
 */

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const EMBED_URL = "https://openrouter.ai/api/v1/embeddings";

export async function chatCompletions({
  apiKey,
  model,
  messages,
  temperature = 0,
  fetchImpl,
} = {}) {
  if (!apiKey) {
    return { ok: false, error: "missing_api_key", status: 0, content: null, raw: null };
  }
  const fetchFn = fetchImpl || fetch;
  try {
    const res = await fetchFn(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "openai/gpt-4o-mini",
        temperature,
        messages: messages || [],
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: "http_error",
        status: res.status,
        content: null,
        raw: null,
      };
    }
    const body = await res.json();
    const content = body.choices?.[0]?.message?.content ?? null;
    return { ok: true, error: null, status: res.status, content, raw: body };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "network_error",
      status: 0,
      content: null,
      raw: null,
    };
  }
}

/**
 * Parse first JSON object from model text content.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function parseJsonFromContent(content) {
  if (!content || typeof content !== "string") {
    return { ok: false, error: "empty_content" };
  }
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) {
    return { ok: false, error: "no_json" };
  }
  try {
    const value = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    return { ok: true, value };
  } catch {
    return { ok: false, error: "json_parse" };
  }
}

export async function embed({
  apiKey,
  model,
  input,
  fetchImpl,
} = {}) {
  if (!apiKey) {
    return { ok: false, error: "missing_api_key", embedding: null };
  }
  const texts = Array.isArray(input) ? input : [input];
  const fetchFn = fetchImpl || fetch;
  try {
    const res = await fetchFn(EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "openai/text-embedding-3-small",
        input: texts,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: "http_error", embedding: null, status: res.status };
    }
    const body = await res.json();
    const data = body.data || [];
    if (texts.length === 1) {
      return {
        ok: true,
        error: null,
        embedding: data[0]?.embedding || null,
        embeddings: data.map((d) => d.embedding),
      };
    }
    return {
      ok: true,
      error: null,
      embedding: data[0]?.embedding || null,
      embeddings: data.map((d) => d.embedding),
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "network_error",
      embedding: null,
    };
  }
}
