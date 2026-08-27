import { generateRef } from "./ref.js";
import { emitCaseCreated } from "../admin/events.js";

export async function saveDispatchedCase({
  CaseModel,
  reporter,
  draft,
  dispatch,
  ref,
  channel = "telegram",
}) {
  const caseRef = ref || generateRef();
  const needsTriage = Boolean(draft.jurisdiction?.needsTriage);
  const channelUserId =
    reporter.channelUserId || reporter.telegramUserId || null;
  const doc = await CaseModel.create({
    ref: caseRef,
    channel,
    reporter: {
      channelUserId,
      telegramUserId:
        channel === "telegram"
          ? reporter.telegramUserId || channelUserId
          : reporter.telegramUserId || undefined,
      displayName: reporter.displayName,
    },
    intake: {
      text: draft.text || "",
      photoFileIds: draft.photoFileIds || [],
      language: "ms",
    },
    location: draft.location,
    classification: draft.classification,
    jurisdiction: draft.jurisdiction,
    dispatch: { ...dispatch, requestPayload: dispatch.requestPayload },
    status: needsTriage ? "triaged" : "dispatched",
  });
  try {
    emitCaseCreated(doc);
  } catch (err) {
    console.error("emitCaseCreated failed:", err.message);
  }
  return doc;
}
