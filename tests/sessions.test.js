import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasIntakeText,
  hasPhotos,
  normalizeDraft,
} from "../src/bot/sessions.js";

describe("session draft normalize", () => {
  it("keeps caption text and photo ids for photo+caption flow", () => {
    const draft = normalizeDraft({
      text: "Jalan berlubang",
      photoFileIds: ["file-1"],
      askedPhoto: true,
    });
    assert.equal(draft.text, "Jalan berlubang");
    assert.deepEqual(draft.photoFileIds, ["file-1"]);
    assert.equal(hasIntakeText({ draft }), true);
    assert.equal(hasPhotos({ draft }), true);
  });

  it("fills missing Mixed fields so location gate does not crash", () => {
    const draft = normalizeDraft({});
    assert.equal(draft.text, "");
    assert.deepEqual(draft.photoFileIds, []);
    assert.equal(hasIntakeText({ draft }), false);
    assert.equal(hasPhotos({ draft }), false);
  });
});
