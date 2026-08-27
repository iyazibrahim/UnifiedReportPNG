import { Bot, webhookCallback } from "grammy";
import { classifyReport } from "../classify/classify.js";
import { resolveJurisdiction } from "../jurisdiction/resolver.js";
import { reverseGeocode } from "../location/geocode.js";
import { resolveCitizenPlace } from "../location/resolveLandmark.js";
import { isAllowedPenangLocation } from "../jurisdiction/boundary.js";
import { locateDaerah, daerahLabel } from "../jurisdiction/daerah.js";
import {
  MSG,
  previewMessage,
  submittedMessage,
  formatConfirmMessage,
  STATUS_BM,
} from "./copy.js";
import {
  MENU,
  confirmKeyboard,
  locationKeyboard,
  mainMenuKeyboard,
  photoContinueKeyboard,
  photoSkipKeyboard,
  submitKeyboard,
  textPlaceConfirmKeyboard,
} from "./keyboards.js";
import {
  hasIntakeText,
  hasPhotos,
  loadSession,
  resetSession,
  saveSession,
} from "./sessions.js";
import { resolveToggle } from "../settings/service.js";
import {
  addLandmark,
  applyLabel,
  captureGeocodedTruth,
  captureTruth,
  confirmLocation,
  needsMapPick,
  replaceTruth,
} from "../location/model.js";
import { generateRef } from "../cases/ref.js";
import { saveDispatchedCase } from "../cases/service.js";
import { Case } from "../models/Case.js";
import { MockTicket } from "../models/MockTicket.js";
import {
  checkSubmitAllowed,
  isDuplicateBurst,
  markSubmitSuccess,
} from "./abuse.js";

const MAX_PHOTOS = 5;
const albumAckTimers = new Map(); // media_group_id -> timeout

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

async function replyMenu(ctx, text) {
  await ctx.reply(text, { reply_markup: mainMenuKeyboard() });
}

async function askLocation(ctx) {
  await ctx.reply(MSG.askLocation, { reply_markup: locationKeyboard() });
}

async function formatCaseLine(c) {
  const ticket = await MockTicket.findOne({ caseRef: c.ref })
    .sort({ createdAt: -1 })
    .lean();
  const statusLabel = ticket
    ? STATUS_BM[ticket.status] || ticket.status
    : c.status;
  return `${c.ref} — ${c.jurisdiction?.agencyLabel || "?"} (${statusLabel})`;
}

async function replyStatusList(ctx, userId) {
  const list = await Case.find({ "reporter.telegramUserId": userId })
    .sort({ createdAt: -1 })
    .limit(5);
  if (!list.length) {
    await replyMenu(ctx, MSG.noCases);
    return;
  }
  const lines = [];
  for (const c of list) {
    lines.push(await formatCaseLine(c));
  }
  await replyMenu(ctx, lines.join("\n"));
}

async function startNewReport(ctx, session) {
  await resetSession(session);
  session.step = "awaiting_description";
  await saveSession(session);
  await ctx.reply(MSG.startNew, { reply_markup: mainMenuKeyboard() });
}

async function classifyAndPreview(session, config) {
  const loc = session.draft.location;
  const gate = isAllowedPenangLocation(loc.lat, loc.lng);
  if (!gate.allowed) {
    session.draft.location = null;
    session.step = "awaiting_location";
    await saveSession(session);
    return { rejected: true };
  }
  const classification = await classifyReport(session.draft.text, {
    apiKey: config.openRouterKey,
    model: config.openRouterModel,
  });
  let jurisdiction = resolveJurisdiction({
    categoryId: classification.categoryId,
    lat: loc.lat,
    lng: loc.lng,
    label: {
      display_name: loc.display_name,
      road: loc.road,
    },
  });
  if (session.draft.forceTriage) {
    jurisdiction = {
      ...jurisdiction,
      needsTriage: true,
      reason: `${jurisdiction.reason} · Lokasi tidak pasti (mercu tanda teks) — perlu semakan ops.`,
    };
  }
  session.draft.classification = classification;
  session.draft.jurisdiction = jurisdiction;
  session.step = "awaiting_submit";
  await saveSession(session);
  return { rejected: false };
}

function enrichLocationMeta(labeled, extras = {}) {
  const daerah = extras.daerah || labeled.daerah || locateDaerah(labeled.lat, labeled.lng);
  labeled.daerah = daerah;
  labeled.daerahLabel = daerahLabel(daerah);
  if (extras.placeName) labeled.placeName = extras.placeName;
  if (extras.display_name) labeled.display_name = extras.display_name;
  if (extras.city) labeled.city = extras.city;
  return labeled;
}

async function rejectOutsidePenang(ctx, session) {
  session.draft.location = null;
  session.step = "awaiting_location";
  await saveSession(session);
  await ctx.reply(MSG.outsidePenang, { reply_markup: locationKeyboard() });
}

async function ingestLocation(ctx, session, config) {
  const loc = ctx.message.location;
  if (!loc) return false;
  const truth = captureTruth(loc);
  const gate = isAllowedPenangLocation(truth.lat, truth.lng);
  if (!gate.allowed) {
    await rejectOutsidePenang(ctx, session);
    return true;
  }
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
  let labeled = applyLabel(base, geocode);
  labeled = enrichLocationMeta(labeled);
  // Prefer daerah label over Nominatim city (often "George Town" for Barat Daya)
  if (labeled.daerahLabel) {
    labeled.city = labeled.daerahLabel;
    if (labeled.display_name && /George Town/i.test(labeled.display_name)) {
      labeled.display_name = labeled.display_name.replace(
        /George Town/gi,
        labeled.daerahLabel
      );
    }
  }
  session.draft.location = labeled;
  session.draft.forceTriage = false;
  session.step = "awaiting_confirm";
  await saveSession(session);
  await ctx.replyWithLocation(labeled.lat, labeled.lng);
  await ctx.reply(formatConfirmMessage(labeled), {
    reply_markup: confirmKeyboard(),
  });
  return true;
}

async function resolveTextPlace(ctx, session, config, placeText) {
  await ctx.reply(MSG.locatingPlace);
  const hit = await resolveCitizenPlace(placeText, {
    apiKey: config.openRouterKey,
    model: config.openRouterModel,
    userAgent: config.nominatimUserAgent,
  });
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) {
    session.draft.geocodeFails = (session.draft.geocodeFails || 0) + 1;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.reply(MSG.placeNotFound, { reply_markup: locationKeyboard() });
    return;
  }
  const gate = isAllowedPenangLocation(hit.lat, hit.lng);
  if (!gate.allowed) {
    await rejectOutsidePenang(ctx, session);
    return;
  }
  const source =
    hit.method === "landmark_db"
      ? "landmark_db"
      : hit.method === "landmark_ai" || hit.method === "llm"
        ? "landmark_ai"
        : "text_geocode";
  const truth = captureGeocodedTruth({
    lat: hit.lat,
    lng: hit.lng,
    source,
    landmark: placeText,
  });
  let labeled = applyLabel(truth, hit);
  labeled.landmark = placeText;
  labeled = enrichLocationMeta(labeled, {
    daerah: hit.daerah,
    placeName: hit.placeName,
    display_name: hit.display_name,
    city: hit.city,
  });
  session.draft.location = labeled;
  session.draft.geocodeFails = 0;
  session.draft.forceTriage = false;
  session.step = "awaiting_confirm";
  await saveSession(session);
  await ctx.replyWithLocation(labeled.lat, labeled.lng);
  await ctx.reply(`${MSG.placeConfirmHint}\n\n${formatConfirmMessage(labeled)}`, {
    reply_markup: textPlaceConfirmKeyboard(),
  });
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
    await replyMenu(ctx, MSG.welcome);
  });

  bot.command("menu", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    await resetSession(session);
    await replyMenu(ctx, MSG.welcome);
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
        await replyMenu(ctx, "Rujukan tidak dijumpai.");
        return;
      }
      const ticket = await MockTicket.findOne({ caseRef: found.ref })
        .sort({ createdAt: -1 })
        .lean();
      const statusLabel = ticket
        ? STATUS_BM[ticket.status] || ticket.status
        : found.status;
      await replyMenu(
        ctx,
        `${found.ref}\n${found.jurisdiction?.agencyLabel || ""}\nStatus: ${statusLabel}\nTiket: ${found.dispatch?.externalRef || ticket?.externalRef || "-"}`
      );
      return;
    }
    await replyStatusList(ctx, userId);
  });

  bot.command("help", async (ctx) => {
    await replyMenu(ctx, MSG.help);
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
    await askLocation(ctx);
  });

  bot.callbackQuery("photo_done", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!hasIntakeText(session)) {
      await ctx.answerCallbackQuery({ text: "Hantar keterangan dulu" });
      return;
    }
    if (!hasPhotos(session)) {
      await ctx.answerCallbackQuery({ text: "Tiada gambar lagi" });
      return;
    }
    session.draft.askedPhoto = true;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.answerCallbackQuery();
    await askLocation(ctx);
  });

  bot.callbackQuery("loc_no", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    session.draft.location = null;
    session.draft.forceTriage = false;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.answerCallbackQuery();
    await askLocation(ctx);
  });

  bot.callbackQuery("loc_retry_text", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    session.draft.location = null;
    session.draft.forceTriage = false;
    session.step = "awaiting_location";
    await saveSession(session);
    await ctx.answerCallbackQuery();
    await askLocation(ctx);
  });

  bot.callbackQuery("loc_uncertain", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!session.draft.location) {
      await ctx.answerCallbackQuery({ text: "Lokasi belum dicari" });
      return;
    }
    if (!hasIntakeText(session)) {
      await ctx.answerCallbackQuery({ text: "Hantar keterangan dulu" });
      return;
    }
    session.draft.forceTriage = true;
    session.draft.location = confirmLocation(
      session.draft.location,
      "uncertain_text_geocode"
    );
    const result = await classifyAndPreview(session, config);
    await ctx.answerCallbackQuery();
    if (result.rejected) {
      await ctx.reply(MSG.outsidePenang, { reply_markup: locationKeyboard() });
      return;
    }
    await ctx.reply(previewMessage(session.draft), {
      reply_markup: submitKeyboard(),
    });
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
    await ctx.reply(MSG.askLandmark, { reply_markup: mainMenuKeyboard() });
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
    session.draft.forceTriage = false;
    session.draft.location = confirmLocation(
      session.draft.location,
      "button_yes"
    );
    const result = await classifyAndPreview(session, config);
    await ctx.answerCallbackQuery();
    if (result.rejected) {
      await ctx.reply(MSG.outsidePenang, { reply_markup: locationKeyboard() });
      return;
    }
    await ctx.reply(previewMessage(session.draft), {
      reply_markup: submitKeyboard(),
    });
  });

  bot.callbackQuery("submit_cancel", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    await resetSession(session);
    await ctx.answerCallbackQuery();
    await replyMenu(ctx, MSG.cancelled);
  });

  bot.callbackQuery("submit_yes", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    const loc = session.draft.location;
    if (!loc?.confirmed || !session.draft.jurisdiction || !gateway) {
      await ctx.answerCallbackQuery({ text: "Sesi tidak lengkap" });
      return;
    }
    const gate = await checkSubmitAllowed(ctx.from.id);
    if (!gate.ok) {
      await ctx.answerCallbackQuery({ text: "Had dicapai" });
      await replyMenu(ctx, gate.message || MSG.rateLimited);
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
      markSubmitSuccess(ctx.from.id);
      await resetSession(session);
      await ctx.answerCallbackQuery();
      await replyMenu(
        ctx,
        submittedMessage(
          typeof caseDoc.toObject === "function" ? caseDoc.toObject() : caseDoc
        )
      );
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "Gagal hantar" });
      await replyMenu(ctx, `Gagal hantar: ${err.message}`);
    }
  });

  bot.on("message:location", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    if (!hasIntakeText(session)) {
      if (hasPhotos(session)) {
        session.step = "awaiting_description";
        await saveSession(session);
        await ctx.reply(MSG.askDescriptionAfterPhoto, {
          reply_markup: mainMenuKeyboard(),
        });
      } else {
        await replyMenu(ctx, MSG.needText);
      }
      return;
    }
    await ingestLocation(ctx, session, config);
  });

  bot.on("message:photo", async (ctx) => {
    const session = await loadSession(ctx.from.id);
    const fileId = largestPhotoId(ctx);
    const caption = ctx.message.caption?.trim();
    if (caption) {
      if (isDuplicateBurst(ctx.from.id, caption)) return;
      session.draft.text = caption;
    }

    // First message is photo without prior text → ask description after storing photo
    if (!hasIntakeText(session) && !hasPhotos(session) && fileId) {
      session.draft.photoFileIds.push(fileId);
      session.draft.askedPhoto = true;
      session.step = "awaiting_description";
      await saveSession(session);
      await ctx.reply(MSG.askDescriptionAfterPhoto, {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    if (!hasIntakeText(session)) {
      if (fileId) session.draft.photoFileIds.push(fileId);
      session.draft.askedPhoto = true;
      session.step = "awaiting_description";
      await saveSession(session);
      await ctx.reply(MSG.askDescriptionAfterPhoto, {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    // Collecting photos (stay until Teruskan / max)
    const count = session.draft.photoFileIds?.length || 0;
    if (count >= MAX_PHOTOS) {
      await ctx.reply(MSG.photoTooMany(MAX_PHOTOS), {
        reply_markup: photoContinueKeyboard(true),
      });
      return;
    }

    if (fileId && !session.draft.photoFileIds.includes(fileId)) {
      session.draft.photoFileIds.push(fileId);
    }
    session.draft.askedPhoto = true;
    session.step = "awaiting_photo";
    await saveSession(session);

    const n = session.draft.photoFileIds.length;
    const mediaGroupId = ctx.message.media_group_id
      ? String(ctx.message.media_group_id)
      : null;

    const replyCollecting = async () => {
      if (n >= MAX_PHOTOS) {
        session.step = "awaiting_location";
        await saveSession(session);
        await ctx.reply(MSG.photoLimitReached(MAX_PHOTOS));
        await askLocation(ctx);
        return;
      }
      await ctx.reply(MSG.photoReceived(n, MAX_PHOTOS), {
        reply_markup: photoContinueKeyboard(true),
      });
    };

    if (mediaGroupId) {
      const key = `${ctx.from.id}:${mediaGroupId}`;
      clearTimeout(albumAckTimers.get(key));
      albumAckTimers.set(
        key,
        setTimeout(() => {
          albumAckTimers.delete(key);
          replyCollecting().catch(() => {});
        }, 1500)
      );
      return;
    }

    await replyCollecting();
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
      const session = await loadSession(ctx.from.id);
      if (session.step === "idle" || session.step === "awaiting_description") {
        await replyMenu(ctx, MSG.idleHint);
      }
    }
  );

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;
    const session = await loadSession(ctx.from.id);
    const text = ctx.message.text.trim();
    if (isDuplicateBurst(ctx.from.id, text)) return;

    // Main menu actions (always handled, even mid-flow)
    if (text === MENU.NEW) {
      await startNewReport(ctx, session);
      return;
    }
    if (text === MENU.STATUS) {
      await replyStatusList(ctx, String(ctx.from.id));
      return;
    }
    if (text === MENU.HELP) {
      await replyMenu(ctx, MSG.help);
      return;
    }
    if (text === MENU.BACK) {
      await resetSession(session);
      await replyMenu(ctx, MSG.backToMenu);
      return;
    }

    if (session.step === "awaiting_landmark") {
      session.draft.location = addLandmark(session.draft.location, text);
      session.draft.location = confirmLocation(
        session.draft.location,
        "button_yes_plus_landmark"
      );
      const result = await classifyAndPreview(session, config);
      if (result.rejected) {
        await ctx.reply(MSG.outsidePenang, { reply_markup: locationKeyboard() });
        return;
      }
      await ctx.reply(previewMessage(session.draft), {
        reply_markup: submitKeyboard(),
      });
      return;
    }

    if (session.step === "awaiting_submit") {
      await ctx.reply("Sila tekan Hantar atau Batal pada ringkasan tadi.");
      return;
    }

    if (session.step === "idle") {
      // Cleared chat / cold open: re-show welcome + reply keyboard
      await replyMenu(ctx, MSG.welcome);
      return;
    }

    if (session.step === "awaiting_description") {
      session.draft.text = text;
      if (!session.draft.askedPhoto && !hasPhotos(session)) {
        session.draft.askedPhoto = true;
        session.step = "awaiting_photo";
        await saveSession(session);
        await ctx.reply(MSG.askPhoto, { reply_markup: photoSkipKeyboard() });
        return;
      }
      if (hasPhotos(session)) {
        session.step = "awaiting_photo";
        await saveSession(session);
        await ctx.reply(
          MSG.photoReceived(session.draft.photoFileIds.length, MAX_PHOTOS),
          { reply_markup: photoContinueKeyboard(true) }
        );
        return;
      }
      session.step = "awaiting_location";
      await saveSession(session);
      await askLocation(ctx);
      return;
    }

    // Location step: typed landmark / place → AI + Nominatim
    if (
      session.step === "awaiting_location" ||
      session.step === "awaiting_confirm"
    ) {
      if (!hasIntakeText(session)) {
        session.draft.text = text;
        session.step = "awaiting_location";
        await saveSession(session);
        await askLocation(ctx);
        return;
      }
      await resolveTextPlace(ctx, session, config, text);
      return;
    }

    if (session.step === "awaiting_photo") {
      // User typed instead of photo — treat as reminder
      await ctx.reply(MSG.askPhoto, {
        reply_markup: photoContinueKeyboard(hasPhotos(session)),
      });
      return;
    }

    // Fallback: treat as new description
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
    await askLocation(ctx);
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
