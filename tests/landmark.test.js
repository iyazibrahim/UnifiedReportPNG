import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { forwardGeocode } from "../src/location/geocode.js";
import { resolveLandmarkWithLlm } from "../src/location/resolveLandmark.js";
import { captureGeocodedTruth, applyLabel } from "../src/location/model.js";

describe("forwardGeocode", () => {
  it("returns the first Nominatim hit biased to Malaysia", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => [
        {
          lat: "5.4213",
          lon: "100.3442",
          display_name: "Padang Kota Lama, George Town, Penang",
          address: { road: "Esplanade", city: "George Town" },
        },
      ],
    });
    const hit = await forwardGeocode("Padang Kota Lama Penang", {
      fetchImpl,
      userAgent: "test",
    });
    assert.equal(hit.lat, 5.4213);
    assert.equal(hit.lng, 100.3442);
    assert.match(hit.display_name, /Padang Kota/);
  });
});

describe("resolveLandmarkWithLlm", () => {
  it("falls back to raw query without API key", async () => {
    const r = await resolveLandmarkWithLlm("Jetty Butterworth", {});
    assert.equal(r.ok, true);
    assert.match(r.searchQuery, /Jetty Butterworth/);
    assert.equal(r.method, "raw_fallback");
  });

  it("parses LLM JSON searchQuery", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"ok":true,"searchQuery":"Butterworth Ferry Terminal Penang","areaHint":"seberang","confidence":0.9}',
            },
          },
        ],
      }),
    });
    const r = await resolveLandmarkWithLlm("Jetty Butterworth", {
      apiKey: "sk-test",
      fetchImpl,
    });
    assert.equal(r.ok, true);
    assert.equal(r.searchQuery, "Butterworth Ferry Terminal Penang");
    assert.equal(r.areaHint, "seberang");
    assert.equal(r.method, "llm");
  });
});

describe("captureGeocodedTruth", () => {
  it("keeps citizen landmark words on the pin", () => {
    const truth = captureGeocodedTruth({
      lat: 5.4,
      lng: 100.3,
      source: "landmark_ai",
      landmark: "depan nasi kandar kepala batas",
    });
    const labeled = applyLabel(truth, {
      display_name: "Kepala Batas, Penang",
      road: null,
    });
    labeled.landmark = truth.landmark;
    assert.equal(labeled.source, "landmark_ai");
    assert.equal(labeled.landmark, "depan nasi kandar kepala batas");
    assert.equal(labeled.confirmed, false);
  });
});
