import { loadConfig } from "./config.js";
import { assertProductionSecrets } from "./config/validate.js";
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
import { ensureUsersSeeded } from "./auth/users.js";
import {
  createWhatsAppClient,
  ensureMediaDir,
} from "./channels/whatsapp/client.js";
import { resolveWhatsAppCreds } from "./channels/whatsapp/webhook.js";

const config = loadConfig();
assertProductionSecrets(config);

await connectDb(config.mongoUri);
await ensureSettingsSeeded();
await ensureUsersSeeded(config);
await ensureMediaDir();

const tokenResolved = await resolveSecret("telegramBotToken");
const webhookResolved = await resolveConfig("telegramWebhookUrl");
const webhookSecretResolved = await resolveSecret("telegramWebhookSecret");
const openRouterKey = await resolveSecret("openRouterApiKey");
const openRouterModel = await resolveConfig(
  "openRouterModel",
  process.env,
  "openai/gpt-4o-mini"
);
const aiPrimaryModel = await resolveConfig(
  "aiPrimaryModel",
  process.env,
  openRouterModel.value || "openai/gpt-4o-mini"
);
const aiStrongModel = await resolveConfig(
  "aiStrongModel",
  process.env,
  "openai/gpt-4o"
);
const aiEmbeddingModel = await resolveConfig(
  "aiEmbeddingModel",
  process.env,
  "openai/text-embedding-3-small"
);
const nominatimUa = await resolveConfig(
  "nominatimUserAgent",
  process.env,
  "UnifiedReportPenang/1.0"
);
const waCreds = await resolveWhatsAppCreds();

const runtimeConfig = {
  ...config,
  telegramToken: tokenResolved.value || config.telegramToken,
  webhookUrl: webhookResolved.value || config.webhookUrl,
  webhookSecret: webhookSecretResolved.value || config.webhookSecret,
  openRouterKey: openRouterKey.value || config.openRouterKey,
  openRouterModel:
    aiPrimaryModel.value ||
    openRouterModel.value ||
    config.openRouterModel,
  aiPrimaryModel:
    aiPrimaryModel.value || openRouterModel.value || config.aiPrimaryModel,
  aiStrongModel: aiStrongModel.value || config.aiStrongModel,
  aiEmbeddingModel: aiEmbeddingModel.value || config.aiEmbeddingModel,
  nominatimUserAgent: nominatimUa.value || config.nominatimUserAgent,
};

const hasTelegram = Boolean(runtimeConfig.telegramToken);
const hasWhatsApp = Boolean(waCreds.accessToken && waCreds.phoneNumberId);

if (!hasTelegram && !hasWhatsApp) {
  console.error(
    "At least one channel is required: TELEGRAM_BOT_TOKEN or WhatsApp access token + phone number ID (env or Settings)"
  );
  process.exit(1);
}

const gateway = createGateway(createPersistedAdapters());
const bot = hasTelegram ? createBot(runtimeConfig, { gateway }) : null;

const senders = {
  telegram: bot
    ? (chatId, text) => bot.api.sendMessage(chatId, text)
    : undefined,
  whatsapp: hasWhatsApp
    ? async (chatId, text) => {
        const creds = await resolveWhatsAppCreds();
        if (!creds.accessToken || !creds.phoneNumberId) {
          throw new Error("WhatsApp credentials not configured");
        }
        const client = createWhatsAppClient(creds);
        return client.sendText(chatId, text);
      }
    : undefined,
};
senders.sendMessage = senders.telegram;

const app = createApp({
  config: runtimeConfig,
  bot,
  gateway,
  senders,
});

const server = app.listen(config.port, async () => {
  console.log(`Listening on ${config.port}`);
  console.log(`Admin: http://localhost:${config.port}/admin`);
  if (bot) {
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
      console.log(`Telegram webhook set: ${runtimeConfig.webhookUrl}`);
    } else {
      bot.start({
        onStart: () => console.log("Telegram polling started"),
      });
    }
  } else {
    console.log("Telegram channel not configured — skipped");
  }
  if (hasWhatsApp) {
    console.log("WhatsApp Cloud API ready at /whatsapp/webhook");
  } else {
    console.log("WhatsApp channel not configured — webhook still mounted for verify setup");
  }
});

process.once("SIGINT", () => {
  if (bot) bot.stop();
  server.close();
  process.exit(0);
});
process.once("SIGTERM", () => {
  if (bot) bot.stop();
  server.close();
  process.exit(0);
});
