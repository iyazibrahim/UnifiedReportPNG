import { loadConfig } from "./config.js";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";
import { createBot, setupBotUi } from "./bot/createBot.js";
import { createGateway } from "./adapters/gateway.js";
import { createPersistedAdapters } from "./adapters/persist.js";
import {
  ensureSettingsSeeded,
  resolveSecret,
  resolveConfig,
} from "./settings/service.js";

const config = loadConfig();

await connectDb(config.mongoUri);
await ensureSettingsSeeded();

const tokenResolved = await resolveSecret("telegramBotToken");
const webhookResolved = await resolveConfig("telegramWebhookUrl");
const webhookSecretResolved = await resolveSecret("telegramWebhookSecret");
const openRouterKey = await resolveSecret("openRouterApiKey");
const openRouterModel = await resolveConfig(
  "openRouterModel",
  process.env,
  "openai/gpt-4o-mini"
);
const nominatimUa = await resolveConfig(
  "nominatimUserAgent",
  process.env,
  "UnifiedReportPenang/1.0 (mvp)"
);

const runtimeConfig = {
  ...config,
  telegramToken: tokenResolved.value || config.telegramToken,
  webhookUrl: webhookResolved.value || config.webhookUrl,
  webhookSecret: webhookSecretResolved.value || config.webhookSecret,
  openRouterKey: openRouterKey.value || config.openRouterKey,
  openRouterModel: openRouterModel.value || config.openRouterModel,
  nominatimUserAgent: nominatimUa.value || config.nominatimUserAgent,
};

if (!runtimeConfig.telegramToken) {
  console.error(
    "TELEGRAM_BOT_TOKEN is required (env or dashboard Settings)"
  );
  process.exit(1);
}

const gateway = createGateway(createPersistedAdapters());
const bot = createBot(runtimeConfig, { gateway });
const app = createApp({ config: runtimeConfig, bot });

const server = app.listen(config.port, async () => {
  console.log(`Listening on ${config.port}`);
  console.log(`Admin: http://localhost:${config.port}/admin`);
  try {
    await setupBotUi(bot);
    console.log("Telegram commands / menu registered");
  } catch (err) {
    console.warn("Failed to register Telegram UI:", err.message);
  }
  if (runtimeConfig.webhookUrl) {
    await bot.api.setWebhook(runtimeConfig.webhookUrl, {
      secret_token: runtimeConfig.webhookSecret || undefined,
    });
    console.log(`Webhook set: ${runtimeConfig.webhookUrl}`);
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
