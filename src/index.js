import { loadConfig } from "./config.js";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";
import { createBot } from "./bot/createBot.js";
import { createGateway } from "./adapters/gateway.js";
import { createPersistedAdapters } from "./adapters/persist.js";

const config = loadConfig();

if (!config.telegramToken) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

await connectDb(config.mongoUri);
const gateway = createGateway(createPersistedAdapters());
const bot = createBot(config, { gateway });
const app = createApp({ config, bot });

const server = app.listen(config.port, async () => {
  console.log(`Listening on ${config.port}`);
  if (config.webhookUrl) {
    await bot.api.setWebhook(config.webhookUrl, {
      secret_token: config.webhookSecret || undefined,
    });
    console.log(`Webhook set: ${config.webhookUrl}`);
  } else {
    bot.start({
      onStart: () => console.log("Telegram polling started"),
    });
  }
});

process.once("SIGINT", () => {
  bot.stop();
  server.close();
  process.exit(0);
});
process.once("SIGTERM", () => {
  bot.stop();
  server.close();
  process.exit(0);
});
