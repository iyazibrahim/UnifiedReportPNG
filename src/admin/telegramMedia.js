import { resolveSecret } from "../settings/service.js";

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

function guessContentType(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
