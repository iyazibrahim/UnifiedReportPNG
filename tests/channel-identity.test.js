import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reporterFilter } from "../src/models/Case.js";
import { MENU } from "../src/intake/buttons.js";

describe("reporterFilter", () => {
  it("isolates whatsapp users from telegram", () => {
    const wa = reporterFilter("whatsapp", "60111");
    const tg = reporterFilter("telegram", "60111");
    assert.deepEqual(wa, {
      channel: "whatsapp",
      "reporter.channelUserId": "60111",
    });
    assert.ok(tg.$or);
    assert.notDeepEqual(wa, tg);
  });
});

describe("shared menu labels", () => {
  it("keeps Telegram / WhatsApp menu strings aligned", () => {
    assert.equal(MENU.NEW, "Aduan Baharu");
    assert.equal(MENU.STATUS, "Semak Aduan");
    assert.equal(MENU.HELP, "Bantuan");
  });
});
