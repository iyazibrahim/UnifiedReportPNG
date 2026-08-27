import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  verifyWhatsAppSignature,
  createWhatsAppClient,
} from "../src/channels/whatsapp/client.js";
import { parseWhatsAppWebhook } from "../src/channels/whatsapp/webhook.js";
import crypto from "node:crypto";

describe("WhatsApp webhook verify signature", () => {
  it("accepts a valid sha256 HMAC", () => {
    const secret = "test-app-secret";
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(
      verifyWhatsAppSignature(body, `sha256=${hmac}`, secret),
      true
    );
  });

  it("rejects a wrong signature", () => {
    const body = Buffer.from("{}");
    assert.equal(
      verifyWhatsAppSignature(body, "sha256=deadbeef", "secret"),
      false
    );
  });

  it("rejects missing signature header", () => {
    assert.equal(verifyWhatsAppSignature(Buffer.from("{}"), null, "secret"), false);
  });
});

describe("parseWhatsAppWebhook", () => {
  it("maps text, location, image, and button messages", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "60123456789", profile: { name: "Ali" } }],
                messages: [
                  {
                    from: "60123456789",
                    type: "text",
                    text: { body: "jalan berlubang" },
                  },
                  {
                    from: "60123456789",
                    type: "location",
                    location: { latitude: 5.41, longitude: 100.33 },
                  },
                  {
                    from: "60123456789",
                    type: "image",
                    image: { id: "media123", caption: "lubang" },
                  },
                  {
                    from: "60123456789",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: { id: "loc_yes", title: "Ya" },
                    },
                  },
                  {
                    from: "60123456789",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: { id: "menu_new", title: "Aduan Baharu" },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseWhatsAppWebhook(body);
    assert.equal(events.length, 5);
    assert.equal(events[0].type, "text");
    assert.equal(events[0].channel, "whatsapp");
    assert.equal(events[0].channelUserId, "60123456789");
    assert.equal(events[0].text, "jalan berlubang");
    assert.equal(events[1].type, "location");
    assert.equal(events[1].location.latitude, 5.41);
    assert.equal(events[2].type, "image");
    assert.equal(events[2]._waMediaId, "media123");
    assert.equal(events[3].type, "button");
    assert.equal(events[3].buttonId, "loc_yes");
    assert.equal(events[4].type, "text");
    assert.equal(events[4].text, "Aduan Baharu");
  });
});

describe("WhatsApp client sendText", () => {
  it("posts to Graph messages endpoint", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        async json() {
          return { messages: [{ id: "wamid.1" }] };
        },
      };
    };
    const client = createWhatsAppClient(
      { accessToken: "tok", phoneNumberId: "123" },
      { fetchImpl }
    );
    await client.sendText("60111", "hello");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/123\/messages$/);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.to, "60111");
    assert.equal(body.text.body, "hello");
  });
});

describe("WhatsApp webhook GET verify", () => {
  it("returns challenge when verify token matches", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
    const { createApp } = await import("../src/app.js");
    const app = createApp({
      config: { opsUser: "ops", opsPassword: "x", webhookUrl: "" },
      bot: null,
      gateway: {},
    });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = server.address();
    try {
      const ok = await fetch(
        `http://127.0.0.1:${port}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345`
      );
      assert.equal(ok.status, 200);
      assert.equal(await ok.text(), "12345");

      const bad = await fetch(
        `http://127.0.0.1:${port}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`
      );
      assert.equal(bad.status, 403);
    } finally {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });
});
