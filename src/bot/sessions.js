import { emptyDraft } from "./copy.js";
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

export async function loadSession(telegramUserId) {
  const id = String(telegramUserId);
  let doc = await Session.findOne({ telegramUserId: id });
  if (!doc) {
    doc = await Session.create({
      telegramUserId: id,
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
