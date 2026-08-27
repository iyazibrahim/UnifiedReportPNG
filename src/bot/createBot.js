import { Bot, webhookCallback } from "grammy";
import { InlineKeyboard } from "grammy";
import { resolveToggle } from "../settings/service.js";
import { handleIntakeEvent, MAX_PHOTOS } from "../intake/engine.js";
import {
  MENU,
  mainMenuKeyboard,
  locationKeyboard,
} from "./keyboards.js";

const albumAckTimers = new Map();

function displayName(ctx) {
  return [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
}

function largestPhotoId(ctx) {
  const photos = ctx.message?.photo;
  if (!photos?.length) return null;
  return photos[photos.length - 1].file_id;
}

function toInlineKeyboard(buttons) {
  const kb = new InlineKeyboard();
  buttons.forEach((b, i) => {
    if (i > 0) kb.row();
    kb.text(b.label, b.id);
  });
  return kb;
}

function createTelegramReply(ctx) {
  return {
    async sendText(text, opts = {}) {
      const keyboard = opts.keyboard;
      if (keyboard === "menu") {
        await ctx.reply(text, { reply_markup: mainMenuKeyboard() });
      } else if (keyboard === "location") {
        await ctx.reply(text, { reply_markup: locationKeyboard() });
      } else {
        await ctx.reply(text);
      }
    },
    async sendLocation(lat, lng) {
      await ctx.replyWithLocation(lat, lng);
    },
    async sendButtons(text, buttons) {
      await ctx.reply(text, { reply_markup: toInlineKeyboard(buttons) });
    },
    async answerCallback(opts) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery(opts || {});
      }
    },
  };
}

async function ensureBotEnabled(ctx) {
  if (await resolveToggle("telegramBotEnabled")) return true;
  await ctx.reply(
    "Saluran Telegram sedang dinyahaktifkan sementara. Sila cuba lagi kemudian."
  );
  return false;
}

function baseEvent(ctx) {
  return {
    channel: "telegram",
    channelUserId: String(ctx.from.id),
    displayName: displayName(ctx),
  };
}

export function createBot(config, { gateway } = {}) {
  if (!config.telegramToken) {
    throw new Error("telegramToken required to create Telegram bot");
  }
  const bot = new Bot(config.telegramToken);

  bot.use(async (ctx, next) => {
    if (!(await ensureBotEnabled(ctx))) return;
    return next();
  });

  async function run(ctx, event) {
    await handleIntakeEvent(
      { ...baseEvent(ctx), ...event },
      createTelegramReply(ctx),
      config,
      gateway
    );
  }

  bot.command("start", async (ctx) => {
    await run(ctx, { type: "command", command: "start" });
  });
  bot.command("menu", async (ctx) => {
    await run(ctx, { type: "command", command: "menu" });
  });
  bot.command("help", async (ctx) => {
    await run(ctx, { type: "command", command: "help" });
  });
  bot.command("status", async (ctx) => {
    await run(ctx, {
      type: "command",
      command: "status",
      commandArg: ctx.match || "",
    });
  });

  bot.on("callback_query:data", async (ctx) => {
    await run(ctx, { type: "button", buttonId: ctx.callbackQuery.data });
  });

  bot.on("message:location", async (ctx) => {
    const loc = ctx.message.location;
    await run(ctx, {
      type: "location",
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        horizontal_accuracy: loc.horizontal_accuracy,
      },
    });
  });

  bot.on("message:photo", async (ctx) => {
    const fileId = largestPhotoId(ctx);
    const caption = ctx.message.caption?.trim();
    const mediaGroupId = ctx.message.media_group_id
      ? String(ctx.message.media_group_id)
      : null;

    if (mediaGroupId && fileId) {
      // Debounce album acks: process each photo, but delay the reply via engine
      // by buffering — for simplicity process immediately; engine replies each time.
      // Keep album debounce: only fire engine once after quiet period for the group.
      const key = `${ctx.from.id}:${mediaGroupId}`;
      clearTimeout(albumAckTimers.get(key));
      // Still store each photo immediately by calling engine; for albums we
      // accumulate then send one synthetic image event with the last file.
      // Better: push file ids into a buffer then flush.
      if (!albumAckTimers.has(`${key}:files`)) {
        albumAckTimers.set(`${key}:files`, []);
      }
      const files = albumAckTimers.get(`${key}:files`);
      if (fileId && !files.includes(fileId)) files.push(fileId);
      albumAckTimers.set(
        key,
        setTimeout(async () => {
          albumAckTimers.delete(key);
          const ids = albumAckTimers.get(`${key}:files`) || [];
          albumAckTimers.delete(`${key}:files`);
          // Process each photo id sequentially so draft accumulates
          for (let i = 0; i < ids.length; i++) {
            const isLast = i === ids.length - 1;
            if (!isLast) {
              // Silent accumulate: call engine image without waiting for multi-reply spam
              // Use a no-op reply for intermediate photos
              const silent = {
                async sendText() {},
                async sendLocation() {},
                async sendButtons() {},
                async answerCallback() {},
              };
              await handleIntakeEvent(
                {
                  ...baseEvent(ctx),
                  type: "image",
                  media: { id: ids[i] },
                  text: i === 0 ? caption : undefined,
                },
                silent,
                config,
                gateway
              );
            } else {
              await handleIntakeEvent(
                {
                  ...baseEvent(ctx),
                  type: "image",
                  media: { id: ids[i] },
                  text: ids.length === 1 ? caption : undefined,
                },
                createTelegramReply(ctx),
                config,
                gateway
              );
            }
          }
        }, 1500)
      );
      return;
    }

    await run(ctx, {
      type: "image",
      media: fileId ? { id: fileId } : undefined,
      text: caption,
    });
  });

  bot.on(
    [
      "message:sticker",
      "message:animation",
      "message:voice",
      "message:video",
      "message:document",
      "message:contact",
    ],
    async (ctx) => {
      const { MSG } = await import("./copy.js");
      const { loadSession } = await import("./sessions.js");
      const session = await loadSession("telegram", ctx.from.id);
      if (session.step === "idle" || session.step === "awaiting_description") {
        await createTelegramReply(ctx).sendText(MSG.idleHint, {
          keyboard: "menu",
        });
      }
    }
  );

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;
    await run(ctx, { type: "text", text: ctx.message.text.trim() });
  });

  return bot;
}

/** Register slash-commands + Menu button so users can recover after clearing chat. */
export async function setupBotUi(bot) {
  await bot.api.setMyCommands([
    { command: "start", description: "Mula / paparkan menu utama" },
    { command: "menu", description: "Paparkan menu utama" },
    { command: "status", description: "Semak aduan anda" },
    { command: "help", description: "Bantuan cara guna" },
  ]);
  await bot.api.setChatMenuButton({
    menu_button: { type: "commands" },
  });
  await bot.api.setMyDescription(
    "Saluran Aduan Bersatu Pulau Pinang. Taip /start untuk mula."
  );
  await bot.api.setMyShortDescription(
    "Aduan awam Pulau Pinang — taip /start"
  );
}

export function telegramWebhookMiddleware(bot, secretToken) {
  return webhookCallback(bot, "express", {
    secretToken: secretToken || undefined,
  });
}

export { MAX_PHOTOS };
