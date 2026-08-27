import { Bot, webhookCallback } from "grammy";
import { classifyReport } from "../classify/classify.js";
import { resolveJurisdiction } from "../jurisdiction/resolver.js";
import { reverseGeocode } from "../location/geocode.js";
import {
  addLandmark,
  applyLabel,
  captureTruth,
  confirmLocation,
  formatConfirmMessage,
  needsMapPick,
  replaceTruth,
} from "../location/model.js";
import { generateRef } from "../cases/ref.js";
import { saveDispatchedCase } from "../cases/service.js";
import { Case } from "../models/Case.js";
import {
  MSG,
  previewMessage,
  submittedMessage,
} from "./copy.js";
import {
  confirmKeyboard,
  locationKeyboard,
  photoSkipKeyboard,
  submitKeyboard,
} from "./keyboards.js";
import {
  hasIntakeText,
  hasPhotos,
  loadSession,
  resetSession,
  saveSession,
} from "./sessions.js";
import { resolveToggle } from "../settings/service.js";

function displayName(ctx) {
  return [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
}

function largestPhotoId(ctx) {
  const photos = ctx.message?.photo;
  if (!photos?.length) return null;
  return photos[photos.length - 1].file_id;
}

async function ensureBotEnabled(ctx) {
  if (await resolveToggle("telegramBotEnabled")) return true;
  await ctx.reply(
    "Saluran Telegram sedang dinyahaktifkan sementara. Sila cuba lagi kemudian."
  );
  return false;
}

async function classifyAndPreview(session, config) {
  const classification = await classifyReport(session.draft.text, {
    apiKey: config.openRouterKey,
    model: config.openRouterModel,
  });
  const loc = session.draft.location;
  const jurisdiction = resolveJurisdiction({
    categoryId: classification.categoryId,
    lat: loc.lat,
    lng: loc.lng,
    label: {
      display_name: loc.display_name,
      road: loc.road,
    },
  });
  session.draft.classification = classification;
  session.draft.jurisdiction = jurisdiction;
  session.step = "awaiting_submit";
  await saveSession(session);
}

async function ingestLocation(ctx, session, config) {
  const loc = ctx.message.location;
  if (!loc) return false;
  const truth = captureTruth(loc);
  if (needsMapPick(truth)) {
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.reply(MSG.coarseGps, { reply_markup: locationKeyboard() });
    return true;
  }
  let geocode;
  try {
    geocode = await reverseGeocode(truth.lat, truth.lng, {
      userAgent: config.nominatimUserAgent,
    });
  } catch {
    geocode = { display_name: null, road: null };
  }
  const base = session.draft.location?.confirmed ? replaceTruth(truth) : truth;
  const labeled = applyLabel(base, geocode);
  session.draft.location = labeled;
  session.step = "awaiting_confirm";
  await saveSession(session);
  await ctx.replyWithLocation(labeled.lat, labeled.lng);
  await ctx.reply(formatConfirmMessage(labeled), {
    reply_markup: confirmKeyboard(),
  });
  return true;
}

export function createBot(config, { gateway } = {}) {
  const bot = new Bot(config.telegramToken);

  bot.use(async (ctx, next) => {
    if (!(await ensureBotEnabled(ctx))) return;
    return next();
  });

  bot.command("start", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    await resetSession(session);
    await ctx.reply(MSG.welcome);
  });

  bot.command("status", async (ctx) => {
    const arg = ctx.match?.trim();
    const userId = String(ctx.from.id);
    if (arg) {
      const found = await Case.findOne({
        ref: arg.toUpperCase(),
        "reporter.telegramUserId": userId,
      });
      if (!found) {
        await ctx.reply("Rujukan tidak dijumpai.");
        return;
      }
      await ctx.reply(
        `${found.ref}\n${found.jurisdiction?.agencyLabel || ""}\nStatus: ${found.status}\nTiket: ${found.dispatch?.externalRef || "-"}`
      );
      return;
    }
    const list = await Case.find({ "reporter.telegramUserId": userId })
      .sort({ createdAt: -1 })
      .limit(5);
    if (!list.length) {
      await ctx.reply("Tiada aduan lagi.");
      return;
    }
    const lines = list.map(
      (c) => `${c.ref} — ${c.jurisdiction?.agencyLabel || "?"} (${c.status})`
    );
    await ctx.reply(lines.join("\n"));
  });

  bot.callbackQuery("photo_skip", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!hasIntakeText(session)) {
      await ctx.answerCallbackQuery({ text: "Hantar keterangan dulu" });
      return;
    }
    session.draft.askedPhoto = true;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.answerCallbackQuery();
    await ctx.reply(MSG.askLocation, { reply_markup: locationKeyboard() });
  });

  bot.callbackQuery("loc_no", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    session.draft.location = null;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.answerCallbackQuery();
    await ctx.reply(MSG.askLocation, { reply_markup: locationKeyboard() });
  });

  bot.callbackQuery("loc_yes_landmark", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!session.draft.location) {
      await ctx.answerCallbackQuery({ text: "Hantar lokasi dulu" });
      return;
    }
    session.draft.location = confirmLocation(
      session.draft.location,
      "button_yes_plus_landmark"
    );
    session.step = "awaiting_landmark";
    await saveSession(session);
    await ctx.answerCallbackQuery();
    await ctx.reply(MSG.askLandmark);
  });

  bot.callbackQuery("loc_yes", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!session.draft.location) {
      await ctx.answerCallbackQuery({ text: "Hantar lokasi dulu" });
      return;
    }
    if (!hasIntakeText(session)) {
      await ctx.answerCallbackQuery({ text: "Hantar keterangan dulu" });
      return;
    }
    session.draft.location = confirmLocation(
      session.draft.location,
      "button_yes"
    );
    await classifyAndPreview(session, config);
    await ctx.answerCallbackQuery();
    await ctx.reply(previewMessage(session.draft), {
      reply_markup: submitKeyboard(),
    });
  });

  bot.callbackQuery("submit_cancel", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    await resetSession(session);
    await ctx.answerCallbackQuery();
    await ctx.reply(MSG.cancelled);
  });

  bot.callbackQuery("submit_yes", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    const loc = session.draft.location;
    if (!loc?.confirmed || !session.draft.jurisdiction || !gateway) {
      await ctx.answerCallbackQuery({ text: "Sesi tidak lengkap" });
      return;
    }
    try {
      const ref = generateRef();
      const dispatch = await gateway.dispatch({
        ref,
        channel: "telegram",
        reporter: {
          telegramUserId: String(ctx.from.id),
          displayName: displayName(ctx),
        },
        intake: {
          text: session.draft.text,
          photoFileIds: session.draft.photoFileIds,
          language: "ms",
        },
        location: loc,
        classification: session.draft.classification,
        jurisdiction: session.draft.jurisdiction,
      });
      const caseDoc = await saveDispatchedCase({
        CaseModel: Case,
        ref,
        reporter: {
          telegramUserId: String(ctx.from.id),
          displayName: displayName(ctx),
        },
        draft: session.draft,
        dispatch,
      });
      await resetSession(session);
      await ctx.answerCallbackQuery();
      await ctx.reply(
        submittedMessage(
          typeof caseDoc.toObject === "function" ? caseDoc.toObject() : caseDoc
        )
      );
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "Gagal hantar" });
      await ctx.reply(`Gagal hantar: ${err.message}`);
    }
  });

  bot.on("message:location", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!hasIntakeText(session) && !hasPhotos(session)) {
      await ctx.reply(MSG.needText);
      return;
    }
    if (!hasIntakeText(session)) {
      await ctx.reply(MSG.needText);
      return;
    }
    await ingestLocation(ctx, session, config);
  });

  bot.on("message:photo", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    const fileId = largestPhotoId(ctx);
    if (fileId) session.draft.photoFileIds.push(fileId);
    const caption = ctx.message.caption?.trim();
    if (caption) session.draft.text = caption;
    if (!hasIntakeText(session)) {
      session.step = "idle";
      await saveSession(session);
      await ctx.reply(MSG.needText);
      return;
    }
    session.draft.askedPhoto = true;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.reply(MSG.askLocation, { reply_markup: locationKeyboard() });
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;
    const session = await loadSession(ctx.from.id);
    const text = ctx.message.text.trim();

    if (session.step === "awaiting_landmark") {
      session.draft.location = addLandmark(session.draft.location, text);
      session.draft.location = confirmLocation(
        session.draft.location,
        "button_yes_plus_landmark"
      );
      await classifyAndPreview(session, config);
      await ctx.reply(previewMessage(session.draft), {
        reply_markup: submitKeyboard(),
      });
      return;
    }

    if (session.step === "awaiting_submit") {
      await ctx.reply("Sila tekan Hantar atau Batal pada ringkasan tadi.");
      return;
    }

    // Waiting for location: if description was lost / missing, accept text then re-ask pin
    if (
      session.step === "awaiting_location" ||
      session.step === "awaiting_confirm"
    ) {
      if (!hasIntakeText(session)) {
        session.draft.text = text;
        session.step = "awaiting_location";
        await saveSession(session);
        await ctx.reply(MSG.askLocation, { reply_markup: locationKeyboard() });
        return;
      }
      await ctx.reply(MSG.needLocation, { reply_markup: locationKeyboard() });
      return;
    }

    session.draft.text = text;
    if (!session.draft.askedPhoto && !hasPhotos(session)) {
      session.draft.askedPhoto = true;
      session.step = "awaiting_photo";
      await saveSession(session);
      await ctx.reply(MSG.askPhoto, { reply_markup: photoSkipKeyboard() });
      return;
    }
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.reply(MSG.askLocation, { reply_markup: locationKeyboard() });
  });

  return bot;
}

export function telegramWebhookMiddleware(bot, secretToken) {
  return webhookCallback(bot, "express", {
    secretToken: secretToken || undefined,
  });
}
