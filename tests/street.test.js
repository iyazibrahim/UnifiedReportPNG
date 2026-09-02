import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setStreetName,
  skipStreetName,
  isGpsSource,
} from "../src/location/model.js";
import {
  resolveStreetWithLlm,
  resolveStreetName,
  searchStreetCandidates,
} from "../src/location/resolveStreet.js";
import { toDispatchPayload } from "../src/cases/payload.js";

describe("isGpsSource", () => {
  it("identifies GPS pin sources", () => {
    assert.equal(isGpsSource("whatsapp_pin"), true);
    assert.equal(isGpsSource("telegram_current"), true);
    assert.equal(isGpsSource("landmark_db"), false);
  });
});

describe("setStreetName", () => {
  it("sets road fields without changing coordinates", () => {
    const loc = { lat: 5.41, lng: 100.33, road: null };
    const updated = setStreetName(loc, {
      road: "Jalan Burma",
      road_source: "ai_verified",
      road_user_raw: "jalan burma",
      road_confirmed: true,
    });
    assert.equal(updated.lat, 5.41);
    assert.equal(updated.road, "Jalan Burma");
    assert.equal(updated.road_source, "ai_verified");
    assert.equal(updated.road_user_raw, "jalan burma");
    assert.equal(updated.road_confirmed, true);
  });

  it("skipStreetName marks skipped source", () => {
    const loc = { lat: 5.41, lng: 100.33, road: "Jalan Burma" };
    const updated = skipStreetName(loc);
    assert.equal(updated.road_source, "skipped");
    assert.equal(updated.road_confirmed, false);
  });
});

describe("resolveStreetWithLlm", () => {
  it("falls back without API key", async () => {
    const r = await resolveStreetWithLlm("jalan burma", { daerah: "timur_laut" });
    assert.equal(r.ok, true);
    assert.match(r.searchQueries.join(" "), /jalan burma/i);
  });

  it("parses LLM JSON street response", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"ok":true,"streetName":"Jalan Burma","searchQueries":["Jalan Burma George Town Penang"],"confidence":0.9}',
            },
          },
        ],
      }),
    });
    const r = await resolveStreetWithLlm("jalan burma", {
      apiKey: "sk-test",
      daerah: "timur_laut",
      fetchImpl,
    });
    assert.equal(r.ok, true);
    assert.equal(r.streetName, "Jalan Burma");
  });
});

describe("searchStreetCandidates", () => {
  it("ranks streets near pin higher", async () => {
    const fetchImpl = async (url) => {
      const q = new URL(url).searchParams.get("q");
      if (/jalan burma/i.test(q || "")) {
        return {
          ok: true,
          json: async () => [
            {
              lat: "5.4141",
              lon: "100.3288",
              display_name: "Jalan Burma, George Town",
              class: "highway",
              type: "residential",
              address: { road: "Jalan Burma", city: "George Town" },
            },
            {
              lat: "5.35",
              lon: "100.23",
              display_name: "Jalan Balik Pulau",
              class: "highway",
              type: "residential",
              address: { road: "Jalan Balik Pulau" },
            },
          ],
        };
      }
      return { ok: true, json: async () => [] };
    };
    const hits = await searchStreetCandidates(["Jalan Burma Penang"], {
      lat: 5.4141,
      lng: 100.3288,
      fetchImpl,
      userAgent: "test",
    });
    assert.ok(hits.length >= 1);
    assert.match(hits[0].streetName, /Burma/i);
  });
});

describe("resolveStreetName", () => {
  it("returns best match when Nominatim finds street near pin", async () => {
    const fetchImpl = async (url) => {
      const href = String(url);
      if (href.includes("openrouter")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    '{"ok":true,"streetName":"Jalan Burma","searchQueries":["Jalan Burma George Town Penang"],"confidence":0.9}',
                },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => [
          {
            lat: "5.4141",
            lon: "100.3288",
            display_name: "Jalan Burma, George Town",
            class: "highway",
            type: "residential",
            address: { road: "Jalan Burma" },
          },
        ],
      };
    };
    const result = await resolveStreetName("jalan burma", {
      lat: 5.4141,
      lng: 100.3288,
      daerah: "timur_laut",
      apiKey: "sk-test",
      fetchImpl,
      userAgent: "test",
    });
    assert.ok(result.best);
    assert.match(result.best.streetName, /Burma/i);
    assert.ok(result.confidence > 0.5);
  });

  it("returns no match when Nominatim is empty", async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => [] });
    const result = await resolveStreetName("jalan tidak wujud", {
      lat: 5.41,
      lng: 100.33,
      fetchImpl,
      userAgent: "test",
    });
    assert.equal(result.best, null);
    assert.equal(result.method, "no_match");
  });
});

describe("toDispatchPayload street fields", () => {
  it("includes road_source in dispatch payload", () => {
    const payload = toDispatchPayload({
      ref: "PG-20260101-0001",
      channel: "telegram",
      reporter: {},
      intake: {},
      location: {
        lat: 5.41,
        lng: 100.33,
        road: "Jalan Burma",
        road_source: "gps_detected",
        road_confirmed: true,
      },
      classification: {},
      jurisdiction: {},
    });
    assert.equal(payload.location.road, "Jalan Burma");
    assert.equal(payload.location.road_source, "gps_detected");
    assert.equal(payload.location.road_confirmed, true);
  });
});
