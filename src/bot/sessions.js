import { emptyDraft } from "./copy.js";
import { Session } from "../models/Session.js";

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
  if (!doc.draft) doc.draft = emptyDraft();
  return doc;
}

export async function resetSession(session) {
  session.step = "idle";
  session.draft = emptyDraft();
  await session.save();
  return session;
}
