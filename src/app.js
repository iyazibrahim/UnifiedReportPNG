import express from "express";
import { telegramWebhookMiddleware } from "./bot/createBot.js";
import { createOpsRouter } from "./ops/routes.js";

export function createApp({ config, bot }) {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "unified-report-penang" });
  });
  app.use("/ops", createOpsRouter(config));
  if (bot && config.webhookUrl) {
    app.use(
      "/telegram/webhook",
      telegramWebhookMiddleware(bot, config.webhookSecret)
    );
  }
  return app;
}
