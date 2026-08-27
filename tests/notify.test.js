import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notifyReporterStatusUpdate } from "../src/notify/telegram.js";

describe("notifyReporterStatusUpdate channel routing", () => {
  it("sends via telegram sender for telegram cases", async () => {
    const sent = [];
    const result = await notifyReporterStatusUpdate(
      {
        telegram: async (id, text) => {
          sent.push({ channel: "telegram", id, text });
        },
        whatsapp: async () => {
          throw new Error("should not call whatsapp");
        },
      },
      {
        ref: "URP-1",
        channel: "telegram",
        reporter: { telegramUserId: "99", channelUserId: "99" },
        jurisdiction: { agencyLabel: "Pearl" },
      },
      { status: "received", statusHistory: [{ note: "ok" }] }
    );
    assert.equal(result.sent, true);
    assert.equal(sent[0].channel, "telegram");
    assert.equal(sent[0].id, "99");
    assert.match(sent[0].text, /URP-1/);
  });

  it("sends via whatsapp sender for whatsapp cases", async () => {
    const sent = [];
    const result = await notifyReporterStatusUpdate(
      {
        telegram: async () => {
          throw new Error("should not call telegram");
        },
        whatsapp: async (id, text) => {
          sent.push({ id, text });
        },
      },
      {
        ref: "URP-2",
        channel: "whatsapp",
        reporter: { channelUserId: "60123456789" },
        jurisdiction: { agencyLabel: "Aspire" },
      },
      { status: "in_progress", adapterId: "aspire_mbsp", statusHistory: [] }
    );
    assert.equal(result.sent, true);
    assert.equal(result.channel, "whatsapp");
    assert.equal(sent[0].id, "60123456789");
  });

  it("keeps legacy function-sender API", async () => {
    const sent = [];
    const result = await notifyReporterStatusUpdate(
      async (id, text) => sent.push({ id, text }),
      {
        ref: "URP-3",
        reporter: { telegramUserId: "42" },
        jurisdiction: { agencyLabel: "PBAPP" },
      },
      { status: "resolved", statusHistory: [] }
    );
    assert.equal(result.sent, true);
    assert.equal(sent[0].id, "42");
  });
});
