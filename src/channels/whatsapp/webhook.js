import express from "express";
import {
  createWhatsAppClient,
  verifyWhatsAppSignature,
} from "./client.js";
import { handleIntakeEvent } from "../../intake/engine.js";
import { MENU, mainMenuButtons } from "../../intake/buttons.js";
import { resolveToggle, resolveSecret, resolveConfig } from "../../settings/service.js";

/**
 * Load WhatsApp credentials from settings (DB overrides env).
 */
export async function resolveWhatsAppCreds(env = process.env) {
  const [token, phoneId, appSecret, verifyToken] = await Promise.all([
    resolveSecret("whatsappAccessToken", env),
    resolveConfig("whatsappPhoneNumberId", env),
    resolveSecret("whatsappAppSecret", env),
    resolveSecret("whatsappVerifyToken", env),
  ]);
  return {
    accessToken: token.value || "",
    phoneNumberId: phoneId.value || "",
    appSecret: appSecret.value || "",
    verifyToken: verifyToken.value || "",
  };
}

function createWaReply(client, to) {
  return {
    async sendText(text, opts = {}) {
      if (opts.keyboard === "menu") {
        await client.sendButtons(to, text, mainMenuButtons());
        return;
      }
      if (opts.keyboard === "location") {
        // WhatsApp has no requestLocation — remind user to share pin or type landmark
        const body = `${text}\n\n_Petua: kongsi pin lokasi dari WhatsApp, atau taip mercu tanda._`;
        await client.sendButtons(to, body, [
          { id: "menu_status", label: MENU.STATUS },
          { id: "menu_help", label: MENU.HELP },
          { id: "menu_back", label: "Kembali ke menu" },
        ]);
        return;
      }
      await client.sendText(to, text);
    },
    async sendLocation(lat, lng) {
      await client.sendLocation(to, lat, lng);
    },
    async sendButtons(text, buttons) {
      await client.sendButtons(to, text, buttons);
    },
    async answerCallback() {},
  };
}

function mapMenuButton(buttonId) {
  if (buttonId === "menu_new") return { type: "text", text: MENU.NEW };
  if (buttonId === "menu_status") return { type: "text", text: MENU.STATUS };
  if (buttonId === "menu_help") return { type: "text", text: MENU.HELP };
  if (buttonId === "menu_back") return { type: "text", text: MENU.BACK };
  return { type: "button", buttonId };
}

/**
 * Parse Cloud API webhook payload into intake events.
 */
export function parseWhatsAppWebhook(body) {
  const events = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;
      const contacts = value.contacts || [];
      for (const msg of value.messages) {
        const from = String(msg.from);
        const contact = contacts.find((c) => c.wa_id === msg.from);
        const displayName = contact?.profile?.name || "";
        const base = {
          channel: "whatsapp",
          channelUserId: from,
          displayName,
        };
        if (msg.type === "text") {
          events.push({
            ...base,
            type: "text",
            text: msg.text?.body || "",
          });
        } else if (msg.type === "image") {
          events.push({
            ...base,
            type: "image",
            media: { id: msg.image?.id, mimeType: msg.image?.mime_type },
            text: msg.image?.caption || "",
            _waMediaId: msg.image?.id,
          });
        } else if (msg.type === "location") {
          events.push({
            ...base,
            type: "location",
            location: {
              latitude: msg.location?.latitude,
              longitude: msg.location?.longitude,
            },
          });
        } else if (msg.type === "interactive") {
          const btnId =
            msg.interactive?.button_reply?.id ||
            msg.interactive?.list_reply?.id;
          if (btnId) {
            const mapped = mapMenuButton(btnId);
            events.push({ ...base, ...mapped });
          }
        } else if (msg.type === "button") {
          // Legacy quick-reply
          const btnId = msg.button?.payload || msg.button?.text;
          if (btnId) {
            const mapped = mapMenuButton(btnId);
            events.push({ ...base, ...mapped });
          }
        }
      }
    }
  }
  return events;
}

/**
 * Express router for WhatsApp Cloud API webhooks.
 * Must be mounted with raw body available on req.rawBody for signature check,
 * or pass verifySignature: false for local tests.
 */
export function createWhatsAppWebhookRouter({
  gateway,
  config = {},
  verifySignature = true,
} = {}) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const creds = await resolveWhatsAppCreds();
    if (mode === "subscribe" && token && token === creds.verifyToken) {
      res.status(200).send(String(challenge || ""));
      return;
    }
    res.sendStatus(403);
  });

  router.post("/", async (req, res) => {
    // Always ack quickly; process async
    res.sendStatus(200);

    try {
      if (!(await resolveToggle("whatsappBotEnabled"))) {
        return;
      }
      const creds = await resolveWhatsAppCreds();
      if (!creds.accessToken || !creds.phoneNumberId) {
        return;
      }

      if (verifySignature && creds.appSecret) {
        const sig = req.headers["x-hub-signature-256"];
        const raw = req.rawBody;
        if (!raw || !verifyWhatsAppSignature(raw, sig, creds.appSecret)) {
          console.warn("WhatsApp webhook signature mismatch");
          return;
        }
      }

      const client = createWhatsAppClient(creds);
      const events = parseWhatsAppWebhook(req.body);
      const runtimeConfig = {
        openRouterKey: config.openRouterKey,
        openRouterModel: config.openRouterModel,
        nominatimUserAgent: config.nominatimUserAgent,
      };

      for (const event of events) {
        if (event.type === "image" && event._waMediaId) {
          try {
            const dl = await client.downloadMedia(event._waMediaId);
            event.media = { id: dl.localRef };
          } catch (err) {
            console.error("WhatsApp media download failed:", err.message);
            const reply = createWaReply(client, event.channelUserId);
            await reply.sendText(
              "Maaf, gambar tidak dapat dimuat turun. Sila cuba hantar semula."
            );
            continue;
          }
        }
        delete event._waMediaId;
        const reply = createWaReply(client, event.channelUserId);
        await handleIntakeEvent(event, reply, runtimeConfig, gateway);
      }
    } catch (err) {
      console.error("WhatsApp webhook handler error:", err.message);
    }
  });

  return router;
}
