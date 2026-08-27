import { emptyDraft } from "../bot/copy.js";
import { Session } from "../models/Session.js";

export function normalizeDraft(draft) {
  const base = emptyDraft();
  return {
    ...base,
    ...(draft && typeof draft === "object" ? draft : {}),
    photoFileIds: Array.isArray(draft?.photoFileIds)
      ? draft.photoFileIds
      : [],
    text: draft?.text ? String(draft.text) : "",
    geocodeFails: Number(draft?.geocodeFails) || 0,
    forceTriage: Boolean(draft?.forceTriage),
  };
}

/**
 * Load or create a session for a channel user.
 * Telegram still accepts legacy docs keyed only by telegramUserId.
 */
export async function loadSession(channel, channelUserId) {
  const ch = channel || "telegram";
  const id = String(channelUserId);

  let doc = await Session.findOne({ channel: ch, channelUserId: id });
  if (!doc && ch === "telegram") {
    doc = await Session.findOne({ telegramUserId: id });
    if (doc) {
      doc.channel = "telegram";
      doc.channelUserId = id;
      if (!doc.telegramUserId) doc.telegramUserId = id;
      await doc.save();
    }
  }
  if (!doc) {
    doc = await Session.create({
      channel: ch,
      channelUserId: id,
      telegramUserId: ch === "telegram" ? id : undefined,
      step: "idle",
      draft: emptyDraft(),
    });
  }
  doc.draft = normalizeDraft(doc.draft);
  return doc;
}

/** Persist session; Mixed `draft` requires markModified or mutations are dropped. */
export async function saveSession(session) {
  session.draft = normalizeDraft(session.draft);
  session.markModified("draft");
  await session.save();
  return session;
}

export async function resetSession(session) {
  session.step = "idle";
  session.draft = emptyDraft();
  return saveSession(session);
}

export function hasIntakeText(session) {
  return Boolean(String(session.draft?.text || "").trim());
}

export function hasPhotos(session) {
  return (session.draft?.photoFileIds || []).length > 0;
}
