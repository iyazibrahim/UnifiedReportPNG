import fs from "node:fs/promises";
import path from "node:path";
import { resolveSecret } from "../settings/service.js";
import { MEDIA_DIR } from "../channels/whatsapp/client.js";

/**
 * Download a Telegram file by file_id using the configured bot token.
 */
export async function fetchTelegramFile(fileId, { fetchImpl } = {}) {
  const fetchFn = fetchImpl || fetch;
  const token = (await resolveSecret("telegramBotToken")).value;
  if (!token) {
    throw new Error("Telegram bot token not configured");
  }
  const metaRes = await fetchFn(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const meta = await metaRes.json();
  if (!meta.ok || !meta.result?.file_path) {
    throw new Error(meta.description || "Telegram getFile failed");
  }
  const filePath = meta.result.file_path;
  const fileRes = await fetchFn(
    `https://api.telegram.org/file/bot${token}/${filePath}`
  );
  if (!fileRes.ok) {
    throw new Error("Telegram file download failed");
  }
  const contentType =
    fileRes.headers.get("content-type") || guessContentType(filePath);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, contentType, filePath };
}

/**
 * Resolve a photo ref: local:filename or Telegram file_id.
 */
export async function fetchCasePhoto(fileId, { fetchImpl } = {}) {
  const id = decodeURIComponent(String(fileId || ""));
  if (id.startsWith("local:")) {
    const name = path.basename(id.slice("local:".length));
    if (!name || name.includes("..")) {
      throw new Error("Invalid local media ref");
    }
    const full = path.join(MEDIA_DIR, name);
    const buffer = await fs.readFile(full);
    return {
      buffer,
      contentType: guessContentType(name),
      filePath: name,
    };
  }
  return fetchTelegramFile(id, { fetchImpl });
}

function guessContentType(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
