import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MEDIA_DIR = path.join(__dirname, "..", "..", "data", "media");

const GRAPH = "https://graph.facebook.com/v21.0";

export async function ensureMediaDir() {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}

/**
 * @param {{ accessToken: string, phoneNumberId: string }} creds
 */
export function createWhatsAppClient(creds, { fetchImpl } = {}) {
  const fetchFn = fetchImpl || fetch;
  const { accessToken, phoneNumberId } = creds;

  async function api(pathname, body) {
    const res = await fetchFn(`${GRAPH}${pathname}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.error?.message || `WhatsApp API ${res.status} ${pathname}`;
      throw new Error(msg);
    }
    return data;
  }

  return {
    async sendText(to, text) {
      return api(`/${phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to: String(to),
        type: "text",
        text: { body: String(text).slice(0, 4096) },
      });
    },

    async sendLocation(to, lat, lng, name = "Lokasi aduan") {
      return api(`/${phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to: String(to),
        type: "location",
        location: {
          latitude: lat,
          longitude: lng,
          name,
        },
      });
    },

    /**
     * Reply buttons — WhatsApp allows max 3.
     * @param {string} to
     * @param {string} bodyText
     * @param {Array<{ id: string, label: string }>} buttons
     */
    async sendButtons(to, bodyText, buttons) {
      const sliced = buttons.slice(0, 3).map((b) => ({
        type: "reply",
        reply: {
          id: String(b.id).slice(0, 256),
          title: String(b.label).slice(0, 20),
        },
      }));
      return api(`/${phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        to: String(to),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: String(bodyText).slice(0, 1024) },
          action: { buttons: sliced },
        },
      });
    },

    /**
     * Download inbound media by Graph media id → local file.
     * Returns durable ref `local:<filename>`.
     */
    async downloadMedia(mediaId, { extHint = ".jpg" } = {}) {
      await ensureMediaDir();
      const metaRes = await fetchFn(`${GRAPH}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const meta = await metaRes.json();
      if (!metaRes.ok || !meta.url) {
        throw new Error(meta?.error?.message || "WhatsApp media meta failed");
      }
      const binRes = await fetchFn(meta.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!binRes.ok) {
        throw new Error("WhatsApp media download failed");
      }
      const buf = Buffer.from(await binRes.arrayBuffer());
      const mime = meta.mime_type || binRes.headers.get("content-type") || "";
      const ext = mime.includes("png")
        ? ".png"
        : mime.includes("webp")
          ? ".webp"
          : mime.includes("gif")
            ? ".gif"
            : extHint;
      const name = `wa_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
      await fs.writeFile(path.join(MEDIA_DIR, name), buf);
      return {
        localRef: `local:${name}`,
        contentType: mime || "image/jpeg",
        size: buf.length,
      };
    },
  };
}

export function verifyWhatsAppSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return false;
  if (!signatureHeader || !String(signatureHeader).startsWith("sha256=")) {
    return false;
  }
  const expected = signatureHeader.slice("sha256=".length);
  const hmac = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
