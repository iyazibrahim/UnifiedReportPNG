import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

describe("health endpoint", () => {
  it("returns ok without Telegram or Mongo", async () => {
    const app = createApp({
      config: {
        opsUser: "ops",
        opsPassword: "secret",
        webhookUrl: "",
      },
      bot: null,
    });
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = server.address();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.ok, true);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });
});
