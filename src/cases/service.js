import { generateRef } from "./ref.js";

export async function saveDispatchedCase({
  CaseModel,
  reporter,
  draft,
  dispatch,
  ref,
}) {
  const caseRef = ref || generateRef();
  const needsTriage = Boolean(draft.jurisdiction?.needsTriage);
  const doc = await CaseModel.create({
    ref: caseRef,
    channel: "telegram",
    reporter,
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
  return doc;
}
