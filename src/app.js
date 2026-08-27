import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { telegramWebhookMiddleware } from "./bot/createBot.js";
import { createAdminRouter } from "./admin/routes.js";
import { createMockRouter } from "./mock/routes.js";
import { createWhatsAppWebhookRouter } from "./channels/whatsapp/webhook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardDist = path.join(__dirname, "..", "dashboard", "dist");

/**
 * @param {object} opts
 * @param {object} opts.config
 * @param {import('grammy').Bot} [opts.bot]
 * @param {object} [opts.gateway]
 * @param {object} [opts.senders] channel send helpers for status notify
 */
export function createApp({ config, bot, gateway, senders } = {}) {
  const app = express();

  // Capture raw body for WhatsApp signature verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        if (req.originalUrl?.startsWith("/whatsapp/webhook")) {
          req.rawBody = buf;
        }
      },
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "unified-report-penang" });
  });

  const telegramSend = bot
    ? (chatId, text) => bot.api.sendMessage(chatId, text)
    : undefined;

  const notifySenders = senders || {
    telegram: telegramSend,
    sendMessage: telegramSend,
  };

  app.use("/api/admin", createAdminRouter(config));
  app.use("/api/mock", createMockRouter({ senders: notifySenders }));

  app.get("/ops", (_req, res) => {
    res.redirect(302, "/admin");
  });

  if (bot && config.webhookUrl) {
    app.use(
      "/telegram/webhook",
      telegramWebhookMiddleware(bot, config.webhookSecret)
    );
  }

  app.use(
    "/whatsapp/webhook",
    createWhatsAppWebhookRouter({
      gateway,
      config,
      verifySignature: true,
    })
  );

  app.use(express.static(dashboardDist));

  app.get(/^\/(admin|mock|portals)(\/.*)?$/, (_req, res) => {
    res.sendFile(path.join(dashboardDist, "index.html"), (err) => {
      if (err) {
        res
          .status(503)
          .type("text")
          .send(
            "Dashboard not built yet. Run: npm run build:dashboard"
          );
      }
    });
  });

  return app;
}
