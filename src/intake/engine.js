import { classifyReport } from "../classify/classify.js";
import { resolveJurisdiction } from "../jurisdiction/resolver.js";
import { reverseGeocode } from "../location/geocode.js";
import { resolveCitizenPlaceWithOptions } from "../location/resolveLandmark.js";
import { resolveStreetName } from "../location/resolveStreet.js";
import { isAllowedPenangLocation } from "../jurisdiction/boundary.js";
import { locateDaerah, daerahLabel } from "../jurisdiction/daerah.js";
import {
  MSG,
  previewMessage,
  submittedMessage,
  formatConfirmMessage,
  STATUS_BM,
} from "../bot/copy.js";
import {
  hasIntakeText,
  hasPhotos,
  loadSession,
  resetSession,
  saveSession,
} from "../bot/sessions.js";
import {
  addLandmark,
  applyLabel,
  captureGeocodedTruth,
  captureTruth,
  confirmLocation,
  needsMapPick,
  replaceTruth,
  setStreetName,
  skipStreetName,
  isGpsSource,
} from "../location/model.js";
import { generateRef } from "../cases/ref.js";
import { saveDispatchedCase } from "../cases/service.js";
import { cancelCaseIfReceived } from "../cases/cancel.js";
import { Case, reporterFilter } from "../models/Case.js";
import { MockTicket } from "../models/MockTicket.js";
import {
  checkSubmitAllowed,
  isDuplicateBurst,
  markSubmitSuccess,
} from "../bot/abuse.js";
import {
  MENU,
  BUTTON,
  photoSkipButtons,
  photoContinueButtons,
  confirmButtons,
  textPlaceConfirmButtons,
  placePickButtons,
  streetGpsConfirmButtons,
  streetKnowButtons,
  streetConfirmButtons,
  streetPickButtons,
  submitButtons,
} from "./buttons.js";

export const MAX_PHOTOS = 5;

/**
 * Channel reply surface expected by handleIntakeEvent.
 * @typedef {object} IntakeReply
 * @property {(text: string, opts?: { keyboard?: 'menu'|'location'|'none' }) => Promise<void>} sendText
 * @property {(lat: number, lng: number) => Promise<void>} [sendLocation]
 * @property {(text: string, buttons: Array<{id:string,label:string}>) => Promise<void>} sendButtons
 * @property {(opts?: { text?: string }) => Promise<void>} [answerCallback]
 */

function enrichLocationMeta(labeled, extras = {}) {
  const daerah =
    extras.daerah || labeled.daerah || locateDaerah(labeled.lat, labeled.lng);
  labeled.daerah = daerah;
  labeled.daerahLabel = daerahLabel(daerah);
  if (extras.placeName) labeled.placeName = extras.placeName;
  if (extras.display_name) labeled.display_name = extras.display_name;
  if (extras.city) labeled.city = extras.city;
  return labeled;
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

async function replyStatusList(reply, channel, channelUserId) {
  const list = await Case.find(reporterFilter(channel, channelUserId))
    .sort({ createdAt: -1 })
    .limit(5);
  if (!list.length) {
    await reply.sendText(MSG.noCases, { keyboard: "menu" });
    return;
  }
  const lines = [];
  for (const c of list) {
    lines.push(await formatCaseLine(c));
  }
  await reply.sendText(lines.join("\n"), { keyboard: "menu" });
}

async function proceedToPreview(reply, session, config) {
  const result = await classifyAndPreview(session, config);
  if (result.rejected) {
    await reply.sendText(MSG.outsidePenang, { keyboard: "location" });
    return false;
  }
  await reply.sendButtons(previewMessage(session.draft), submitButtons());
  return true;
}

async function enrichLocationRoad(session, config) {
  const loc = session.draft.location;
  if (!loc || loc.road) return loc;
  try {
    const geocode = await reverseGeocode(loc.lat, loc.lng, {
      userAgent: config.nominatimUserAgent,
    });
    if (geocode?.road) {
      session.draft.location = applyLabel(loc, geocode);
      await saveSession(session);
    }
  } catch {
    // optional enrichment
  }
  return session.draft.location;
}

async function beginStreetFlow(reply, session, config) {
  await enrichLocationRoad(session, config);
  const loc = session.draft.location;
  if (isGpsSource(loc.source) && loc.road) {
    session.step = "awaiting_street_gps_confirm";
    await saveSession(session);
    await reply.sendButtons(
      MSG.streetGpsConfirm(loc.road),
      streetGpsConfirmButtons()
    );
    return;
  }
  session.step = "awaiting_street_know";
  await saveSession(session);
  await reply.sendButtons(MSG.askStreetKnow, streetKnowButtons());
}

async function handleStreetInput(reply, session, config, text) {
  const raw = String(text || "").trim();
  if (!raw) return;
  const loc = session.draft.location;
  await reply.sendText(MSG.streetVerifying);
  const result = await resolveStreetName(raw, {
    lat: loc.lat,
    lng: loc.lng,
    daerah: loc.daerah,
    apiKey: config.openRouterKey,
    model: config.openRouterModel,
    userAgent: config.nominatimUserAgent,
  });
  session.draft.pendingStreetRaw = raw;
  session.draft.pendingStreetCandidates = result.alternatives || [];
  if (result.best && result.confidence >= 0.55) {
    session.draft.pendingStreetBest = result.best;
    session.step = "awaiting_street_confirm";
    await saveSession(session);
    await reply.sendButtons(
      MSG.streetPropose(result.best.streetName),
      streetConfirmButtons((result.alternatives || []).length > 1)
    );
    return;
  }
  if ((result.alternatives || []).length > 0) {
    session.step = "awaiting_street_confirm";
    await saveSession(session);
    await reply.sendButtons(
      MSG.streetNoMatch(raw),
      streetPickButtons(result.alternatives)
    );
    return;
  }
  session.draft.location = setStreetName(loc, {
    road: raw,
    road_source: "user_raw",
    road_user_raw: raw,
    road_confirmed: true,
  });
  session.draft.pendingStreetCandidates = null;
  session.draft.pendingStreetBest = null;
  await saveSession(session);
  await proceedToPreview(reply, session, config);
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

async function rejectOutsidePenang(reply, session) {
  session.draft.location = null;
  session.step = "awaiting_location";
  await saveSession(session);
  await reply.sendText(MSG.outsidePenang, { keyboard: "location" });
}

async function askLocation(reply) {
  await reply.sendText(MSG.askLocation, { keyboard: "location" });
}

async function startNewReport(reply, session) {
  await resetSession(session);
  session.step = "awaiting_description";
  await saveSession(session);
  await reply.sendText(MSG.startNew, { keyboard: "menu" });
}

async function ingestLocation(reply, session, config, locMsg, channel) {
  if (!locMsg) return false;
  const source =
    channel === "whatsapp"
      ? "whatsapp_pin"
      : locMsg.horizontal_accuracy != null
        ? "telegram_current"
        : "telegram_picked";
  const truth = captureTruth(locMsg, { source });
  const gate = isAllowedPenangLocation(truth.lat, truth.lng);
  if (!gate.allowed) {
    await rejectOutsidePenang(reply, session);
    return true;
  }
  if (needsMapPick(truth)) {
    session.step = "awaiting_location";
    await saveSession(session);
    await reply.sendText(MSG.coarseGps, { keyboard: "location" });
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
  if (reply.sendLocation) {
    await reply.sendLocation(labeled.lat, labeled.lng);
  }
  await reply.sendButtons(formatConfirmMessage(labeled), confirmButtons());
  return true;
}

async function applyResolvedPlace(reply, session, placeText, hit) {
  const gate = isAllowedPenangLocation(hit.lat, hit.lng);
  if (!gate.allowed) {
    await rejectOutsidePenang(reply, session);
    return false;
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
  try {
    const geocode = await reverseGeocode(labeled.lat, labeled.lng, {
      userAgent: config.nominatimUserAgent,
    });
    if (geocode?.road && !labeled.road) {
      labeled = applyLabel(labeled, geocode);
    }
  } catch {
    // optional road enrichment
  }
  session.draft.location = labeled;
  session.draft.placeCandidates = null;
  session.draft.geocodeFails = 0;
  session.draft.forceTriage = false;
  session.step = "awaiting_confirm";
  await saveSession(session);
  if (reply.sendLocation) {
    await reply.sendLocation(labeled.lat, labeled.lng);
  }
  await reply.sendButtons(
    `${MSG.placeConfirmHint}\n\n${formatConfirmMessage(labeled)}`,
    textPlaceConfirmButtons()
  );
  return true;
}

async function resolveTextPlace(reply, session, config, placeText) {
  await reply.sendText(MSG.locatingPlace);
  const result = await resolveCitizenPlaceWithOptions(placeText, {
    apiKey: config.openRouterKey,
    model: config.openRouterModel,
    userAgent: config.nominatimUserAgent,
  });
  if (!result.best || !Number.isFinite(result.best.lat) || !Number.isFinite(result.best.lng)) {
    session.draft.geocodeFails = (session.draft.geocodeFails || 0) + 1;
    session.step = "awaiting_location";
    await saveSession(session);
    await reply.sendText(MSG.placeNotFound, { keyboard: "location" });
    return;
  }
  if (result.needsDisambiguation && result.candidates.length > 1) {
    session.draft.placeCandidates = result.candidates;
    session.draft.pendingPlaceText = placeText;
    session.step = "awaiting_place_pick";
    await saveSession(session);
    if (reply.sendLocation) {
      await reply.sendLocation(result.best.lat, result.best.lng);
    }
    await reply.sendButtons(MSG.placeDisambiguation, placePickButtons(result.candidates));
    return;
  }
  await applyResolvedPlace(reply, session, placeText, result.best);
}

async function handleButton(event, session, reply, config, gateway) {
  const id = event.buttonId;
  const { channel, channelUserId, displayName } = event;

  if (id === BUTTON.PHOTO_SKIP) {
    if (!hasIntakeText(session)) {
      await reply.answerCallback?.({ text: "Hantar keterangan dulu" });
      return;
    }
    session.draft.askedPhoto = true;
    session.step = "awaiting_location";
    await saveSession(session);
    await reply.answerCallback?.();
    await askLocation(reply);
    return;
  }

  if (id === BUTTON.PHOTO_DONE) {
    if (!hasIntakeText(session)) {
      await reply.answerCallback?.({ text: "Hantar keterangan dulu" });
      return;
    }
    if (!hasPhotos(session)) {
      await reply.answerCallback?.({ text: "Tiada gambar lagi" });
      return;
    }
    session.draft.askedPhoto = true;
    session.step = "awaiting_location";
    await saveSession(session);
    await reply.answerCallback?.();
    await askLocation(reply);
    return;
  }

  if (id === BUTTON.LOC_NO || id === BUTTON.LOC_RETRY_TEXT || id === BUTTON.LOC_PICK_RETRY) {
    session.draft.location = null;
    session.draft.placeCandidates = null;
    session.draft.pendingPlaceText = null;
    session.draft.forceTriage = false;
    session.step = "awaiting_location";
    await saveSession(session);
    await reply.answerCallback?.();
    await askLocation(reply);
    return;
  }

  if (id.startsWith(BUTTON.LOC_PICK_PREFIX)) {
    const idx = Number(id.slice(BUTTON.LOC_PICK_PREFIX.length));
    const candidates = session.draft.placeCandidates || [];
    const hit = candidates[idx];
    const placeText = session.draft.pendingPlaceText || session.draft.text || "";
    if (!hit || !Number.isFinite(idx)) {
      await reply.answerCallback?.({ text: "Pilihan tidak sah" });
      return;
    }
    await reply.answerCallback?.();
    await applyResolvedPlace(reply, session, placeText, hit);
    return;
  }

  if (id === BUTTON.LOC_UNCERTAIN) {
    if (!session.draft.location) {
      await reply.answerCallback?.({ text: "Lokasi belum dicari" });
      return;
    }
    if (!hasIntakeText(session)) {
      await reply.answerCallback?.({ text: "Hantar keterangan dulu" });
      return;
    }
    session.draft.forceTriage = true;
    session.draft.location = confirmLocation(
      session.draft.location,
      "uncertain_text_geocode"
    );
    const result = await classifyAndPreview(session, config);
    await reply.answerCallback?.();
    if (result.rejected) {
      await reply.sendText(MSG.outsidePenang, { keyboard: "location" });
      return;
    }
    await reply.sendButtons(previewMessage(session.draft), submitButtons());
    return;
  }

  if (id === BUTTON.LOC_YES_LANDMARK) {
    if (!session.draft.location) {
      await reply.answerCallback?.({ text: "Hantar lokasi dulu" });
      return;
    }
    session.draft.location = confirmLocation(
      session.draft.location,
      "button_yes_plus_landmark"
    );
    session.step = "awaiting_landmark";
    await saveSession(session);
    await reply.answerCallback?.();
    await reply.sendText(MSG.askLandmark, { keyboard: "menu" });
    return;
  }

  if (id === BUTTON.LOC_YES) {
    if (!session.draft.location) {
      await reply.answerCallback?.({ text: "Hantar lokasi dulu" });
      return;
    }
    if (!hasIntakeText(session)) {
      await reply.answerCallback?.({ text: "Hantar keterangan dulu" });
      return;
    }
    session.draft.forceTriage = false;
    session.draft.location = confirmLocation(
      session.draft.location,
      "button_yes"
    );
    await saveSession(session);
    await reply.answerCallback?.();
    await beginStreetFlow(reply, session, config);
    return;
  }

  if (id === BUTTON.STREET_GPS_YES) {
    const loc = session.draft.location;
    const road = loc?.road;
    if (!road) {
      await reply.answerCallback?.({ text: "Nama jalan tidak dijumpai" });
      return;
    }
    session.draft.location = setStreetName(loc, {
      road,
      road_source: "gps_detected",
      road_confirmed: true,
    });
    await saveSession(session);
    await reply.answerCallback?.();
    await proceedToPreview(reply, session, config);
    return;
  }

  if (id === BUTTON.STREET_GPS_NO) {
    session.step = "awaiting_street_input";
    await saveSession(session);
    await reply.answerCallback?.();
    await reply.sendText(MSG.askStreetInput, { keyboard: "menu" });
    return;
  }

  if (id === BUTTON.STREET_GPS_SKIP) {
    session.draft.location = skipStreetName(session.draft.location);
    await saveSession(session);
    await reply.answerCallback?.();
    await proceedToPreview(reply, session, config);
    return;
  }

  if (id === BUTTON.STREET_KNOW_YES) {
    session.step = "awaiting_street_input";
    await saveSession(session);
    await reply.answerCallback?.();
    await reply.sendText(MSG.askStreetInput, { keyboard: "menu" });
    return;
  }

  if (id === BUTTON.STREET_KNOW_NO) {
    session.draft.location = skipStreetName(session.draft.location);
    await saveSession(session);
    await reply.answerCallback?.();
    await proceedToPreview(reply, session, config);
    return;
  }

  if (id === BUTTON.STREET_CONFIRM_YES) {
    const best = session.draft.pendingStreetBest;
    const raw = session.draft.pendingStreetRaw;
    if (!best?.streetName) {
      await reply.answerCallback?.({ text: "Padanan tidak dijumpai" });
      return;
    }
    session.draft.location = setStreetName(session.draft.location, {
      road: best.streetName,
      road_source: "ai_verified",
      road_user_raw: raw,
      road_confirmed: true,
    });
    session.draft.pendingStreetCandidates = null;
    session.draft.pendingStreetBest = null;
    await saveSession(session);
    await reply.answerCallback?.();
    await proceedToPreview(reply, session, config);
    return;
  }

  if (id === BUTTON.STREET_USE_RAW) {
    const raw = session.draft.pendingStreetRaw;
    if (!raw) {
      await reply.answerCallback?.({ text: "Tiada teks jalan" });
      return;
    }
    session.draft.location = setStreetName(session.draft.location, {
      road: raw,
      road_source: "user_raw",
      road_user_raw: raw,
      road_confirmed: true,
    });
    session.draft.pendingStreetCandidates = null;
    session.draft.pendingStreetBest = null;
    await saveSession(session);
    await reply.answerCallback?.();
    await proceedToPreview(reply, session, config);
    return;
  }

  if (id === BUTTON.STREET_PICK_OTHER) {
    const candidates = session.draft.pendingStreetCandidates || [];
    if (!candidates.length) {
      await reply.answerCallback?.({ text: "Tiada cadangan" });
      return;
    }
    await reply.answerCallback?.();
    await reply.sendButtons(MSG.streetPickOther, streetPickButtons(candidates));
    return;
  }

  if (id.startsWith(BUTTON.STREET_PICK_PREFIX)) {
    const idx = Number(id.slice(BUTTON.STREET_PICK_PREFIX.length));
    const candidates = session.draft.pendingStreetCandidates || [];
    const pick = candidates[idx];
    const raw = session.draft.pendingStreetRaw;
    if (!pick?.streetName || !Number.isFinite(idx)) {
      await reply.answerCallback?.({ text: "Pilihan tidak sah" });
      return;
    }
    session.draft.location = setStreetName(session.draft.location, {
      road: pick.streetName,
      road_source: "ai_verified",
      road_user_raw: raw,
      road_confirmed: true,
    });
    session.draft.pendingStreetCandidates = null;
    session.draft.pendingStreetBest = null;
    await saveSession(session);
    await reply.answerCallback?.();
    await proceedToPreview(reply, session, config);
    return;
  }

  if (id === BUTTON.SUBMIT_CANCEL) {
    await resetSession(session);
    await reply.answerCallback?.();
    await reply.sendText(MSG.cancelled, { keyboard: "menu" });
    return;
  }

  if (id === BUTTON.SUBMIT_YES) {
    const loc = session.draft.location;
    if (!loc?.confirmed || !session.draft.jurisdiction || !gateway) {
      await reply.answerCallback?.({ text: "Sesi tidak lengkap" });
      return;
    }
    const gate = await checkSubmitAllowed(channel, channelUserId);
    if (!gate.ok) {
      await reply.answerCallback?.({ text: "Had dicapai" });
      await reply.sendText(gate.message || MSG.rateLimited, {
        keyboard: "menu",
      });
      return;
    }
    try {
      const ref = generateRef();
      const reporter = {
        channelUserId: String(channelUserId),
        telegramUserId:
          channel === "telegram" ? String(channelUserId) : undefined,
        displayName: displayName || "",
      };
      const dispatch = await gateway.dispatch({
        ref,
        channel,
        reporter,
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
        channel,
        reporter,
        draft: session.draft,
        dispatch,
      });
      markSubmitSuccess(channel, channelUserId);
      await resetSession(session);
      await reply.answerCallback?.();
      await reply.sendText(
        submittedMessage(
          typeof caseDoc.toObject === "function" ? caseDoc.toObject() : caseDoc
        ),
        { keyboard: "menu" }
      );
    } catch (err) {
      await reply.answerCallback?.({ text: "Gagal hantar" });
      await reply.sendText(`Gagal hantar: ${err.message}`, { keyboard: "menu" });
    }
  }
}

async function handleImage(event, session, reply) {
  const { channel, channelUserId } = event;
  const fileId = event.media?.id;
  const caption = event.text?.trim();
  if (caption) {
    if (isDuplicateBurst(channel, channelUserId, caption)) return;
    session.draft.text = caption;
  }

  if (!hasIntakeText(session) && !hasPhotos(session) && fileId) {
    session.draft.photoFileIds.push(fileId);
    session.draft.askedPhoto = true;
    session.step = "awaiting_description";
    await saveSession(session);
    await reply.sendText(MSG.askDescriptionAfterPhoto, { keyboard: "menu" });
    return;
  }

  if (!hasIntakeText(session)) {
    if (fileId) session.draft.photoFileIds.push(fileId);
    session.draft.askedPhoto = true;
    session.step = "awaiting_description";
    await saveSession(session);
    await reply.sendText(MSG.askDescriptionAfterPhoto, { keyboard: "menu" });
    return;
  }

  const count = session.draft.photoFileIds?.length || 0;
  if (count >= MAX_PHOTOS) {
    await reply.sendButtons(
      MSG.photoTooMany(MAX_PHOTOS),
      photoContinueButtons(true)
    );
    return;
  }

  if (fileId && !session.draft.photoFileIds.includes(fileId)) {
    session.draft.photoFileIds.push(fileId);
  }
  session.draft.askedPhoto = true;
  session.step = "awaiting_photo";
  await saveSession(session);

  const n = session.draft.photoFileIds.length;
  if (n >= MAX_PHOTOS) {
    session.step = "awaiting_location";
    await saveSession(session);
    await reply.sendText(MSG.photoLimitReached(MAX_PHOTOS));
    await askLocation(reply);
    return;
  }
  await reply.sendButtons(
    MSG.photoReceived(n, MAX_PHOTOS),
    photoContinueButtons(true)
  );
}

async function handleText(event, session, reply, config) {
  const { channel, channelUserId } = event;
  const text = String(event.text || "").trim();
  if (!text) return;
  if (isDuplicateBurst(channel, channelUserId, text)) return;

  if (text === MENU.NEW) {
    await startNewReport(reply, session);
    return;
  }
  if (text === MENU.STATUS) {
    await replyStatusList(reply, channel, channelUserId);
    return;
  }
  if (text === MENU.HELP) {
    await reply.sendText(MSG.help, { keyboard: "menu" });
    return;
  }
  if (text === MENU.BACK) {
    await resetSession(session);
    await reply.sendText(MSG.backToMenu, { keyboard: "menu" });
    return;
  }

  if (session.step === "awaiting_landmark") {
    session.draft.location = addLandmark(session.draft.location, text);
    session.draft.location = confirmLocation(
      session.draft.location,
      "button_yes_plus_landmark"
    );
    await saveSession(session);
    await beginStreetFlow(reply, session, config);
    return;
  }

  if (session.step === "awaiting_street_input") {
    await handleStreetInput(reply, session, config, text);
    return;
  }

  if (
    session.step === "awaiting_street_gps_confirm" ||
    session.step === "awaiting_street_know" ||
    session.step === "awaiting_street_confirm"
  ) {
    await reply.sendText("Sila gunakan butang di atas untuk memilih.");
    return;
  }

  if (session.step === "awaiting_submit") {
    await reply.sendText("Sila tekan Hantar atau Batal pada ringkasan tadi.");
    return;
  }

  if (session.step === "idle") {
    await reply.sendText(MSG.welcome, { keyboard: "menu" });
    return;
  }

  if (session.step === "awaiting_description") {
    session.draft.text = text;
    if (!session.draft.askedPhoto && !hasPhotos(session)) {
      session.draft.askedPhoto = true;
      session.step = "awaiting_photo";
      await saveSession(session);
      await reply.sendButtons(MSG.askPhoto, photoSkipButtons());
      return;
    }
    if (hasPhotos(session)) {
      session.step = "awaiting_photo";
      await saveSession(session);
      await reply.sendButtons(
        MSG.photoReceived(session.draft.photoFileIds.length, MAX_PHOTOS),
        photoContinueButtons(true)
      );
      return;
    }
    session.step = "awaiting_location";
    await saveSession(session);
    await askLocation(reply);
    return;
  }

  if (
    session.step === "awaiting_location" ||
    session.step === "awaiting_confirm"
  ) {
    if (!hasIntakeText(session)) {
      session.draft.text = text;
      session.step = "awaiting_location";
      await saveSession(session);
      await askLocation(reply);
      return;
    }
    await resolveTextPlace(reply, session, config, text);
    return;
  }

  if (session.step === "awaiting_photo") {
    await reply.sendButtons(
      MSG.askPhoto,
      photoContinueButtons(hasPhotos(session))
    );
    return;
  }

  session.draft.text = text;
  if (!session.draft.askedPhoto && !hasPhotos(session)) {
    session.draft.askedPhoto = true;
    session.step = "awaiting_photo";
    await saveSession(session);
    await reply.sendButtons(MSG.askPhoto, photoSkipButtons());
    return;
  }
  session.step = "awaiting_location";
  await saveSession(session);
  await askLocation(reply);
}

/**
 * Process one normalized inbound event for any citizen channel.
 *
 * @param {object} event
 * @param {'text'|'image'|'location'|'button'|'command'} event.type
 * @param {'telegram'|'whatsapp'} event.channel
 * @param {string} event.channelUserId
 * @param {string} [event.displayName]
 * @param {string} [event.text]
 * @param {string} [event.buttonId]
 * @param {string} [event.command]
 * @param {string} [event.commandArg]
 * @param {{ id: string }} [event.media]
 * @param {{ latitude: number, longitude: number, horizontal_accuracy?: number }} [event.location]
 * @param {IntakeReply} reply
 * @param {object} config
 * @param {object} [gateway]
 */
export async function handleIntakeEvent(event, reply, config, gateway) {
  const channel = event.channel || "telegram";
  const channelUserId = String(event.channelUserId);
  const session = await loadSession(channel, channelUserId);

  if (event.type === "command") {
    const cmd = event.command;
    if (cmd === "start" || cmd === "menu") {
      await resetSession(session);
      await reply.sendText(MSG.welcome, { keyboard: "menu" });
      return;
    }
    if (cmd === "help") {
      await reply.sendText(MSG.help, { keyboard: "menu" });
      return;
    }
    if (cmd === "status") {
      const arg = event.commandArg?.trim();
      if (arg) {
        const found = await Case.findOne({
          ref: arg.toUpperCase(),
          ...reporterFilter(channel, channelUserId),
        });
        if (!found) {
          await reply.sendText("Rujukan tidak dijumpai.", { keyboard: "menu" });
          return;
        }
        const ticket = await MockTicket.findOne({ caseRef: found.ref })
          .sort({ createdAt: -1 })
          .lean();
        const statusLabel = ticket
          ? STATUS_BM[ticket.status] || ticket.status
          : found.status;
        await reply.sendText(
          `${found.ref}\n${found.jurisdiction?.agencyLabel || ""}\nStatus: ${statusLabel}\nTiket: ${found.dispatch?.externalRef || ticket?.externalRef || "-"}`,
          { keyboard: "menu" }
        );
        return;
      }
      await replyStatusList(reply, channel, channelUserId);
      return;
    }
    if (cmd === "cancel") {
      const arg = event.commandArg?.trim();
      if (!arg) {
        await reply.sendText(
          "Sila taip /cancel PG-YYYYMMDD-XXXX untuk membatalkan aduan yang masih *Diterima*.",
          { keyboard: "menu" }
        );
        return;
      }
      const found = await Case.findOne({
        ref: arg.toUpperCase(),
        ...reporterFilter(channel, channelUserId),
      });
      if (!found) {
        await reply.sendText("Rujukan tidak dijumpai.", { keyboard: "menu" });
        return;
      }
      const result = await cancelCaseIfReceived(found.ref, {
        actor: "pelapor",
      });
      if (!result.ok) {
        if (result.reason === "not_cancellable") {
          await reply.sendText(
            `Aduan ${found.ref} tidak boleh dibatalkan (status: ${STATUS_BM[result.status] || result.status}).`,
            { keyboard: "menu" }
          );
          return;
        }
        await reply.sendText("Aduan tidak boleh dibatalkan.", {
          keyboard: "menu",
        });
        return;
      }
      await reply.sendText(
        `Aduan ${found.ref} telah dibatalkan.`,
        { keyboard: "menu" }
      );
      return;
    }
  }

  if (event.type === "button") {
    await handleButton(event, session, reply, config, gateway);
    return;
  }

  if (event.type === "location") {
    if (!hasIntakeText(session)) {
      if (hasPhotos(session)) {
        session.step = "awaiting_description";
        await saveSession(session);
        await reply.sendText(MSG.askDescriptionAfterPhoto, {
          keyboard: "menu",
        });
      } else {
        await reply.sendText(MSG.needText, { keyboard: "menu" });
      }
      return;
    }
    await ingestLocation(reply, session, config, event.location, channel);
    return;
  }

  if (event.type === "image") {
    await handleImage(event, session, reply);
    return;
  }

  if (event.type === "text") {
    await handleText(event, session, reply, config);
  }
}
