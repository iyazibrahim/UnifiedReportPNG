import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { telegramWebhookMiddleware } from "./bot/createBot.js";
import { createAdminRouter } from "./admin/routes.js";
import { createMockRouter } from "./mock/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardDist = path.join(__dirname, "..", "dashboard", "dist");

export function createApp({ config, bot }) {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "unified-report-penang" });
  });

  const sendMessage = bot
    ? (chatId, text) => bot.api.sendMessage(chatId, text)
    : undefined;

  app.use("/api/admin", createAdminRouter(config));
  app.use("/api/mock", createMockRouter({ sendMessage }));

  app.get("/ops", (_req, res) => {
    res.redirect(302, "/admin");
  });

  if (bot && config.webhookUrl) {
    app.use(
      "/telegram/webhook",
      telegramWebhookMiddleware(bot, config.webhookSecret)
    );
  }

  app.use(express.static(dashboardDist));

  app.get(/^\/(admin|mock)(\/.*)?$/, (_req, res) => {
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
