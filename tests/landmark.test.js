import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { forwardGeocode, forwardGeocodeCandidates } from "../src/location/geocode.js";
import { buildLandmarkQueries } from "../src/location/landmarkQueries.js";
import {
  resolveLandmarkWithLlm,
  resolveCitizenPlace,
} from "../src/location/resolveLandmark.js";
import { captureGeocodedTruth, applyLabel } from "../src/location/model.js";

describe("buildLandmarkQueries", () => {
  it("strips traffic-light / berdekatan and splits slash so Lotus Kepala Batas is searchable", () => {
    const qs = buildLandmarkQueries(
      "traffik light berdekatan lotus kepala batas / bertam"
    );
    const blob = qs.join(" | ").toLowerCase();
    assert.match(blob, /lotus kepala batas/);
    assert.equal(
      qs.some((q) => /traffik|traffic light|berdekatan/i.test(q)),
      false
    );
  });

  it("strips depan so masjid jamek sungai rusa is searchable", () => {
    const qs = buildLandmarkQueries("depan masjid jamek sungai rusa");
    const blob = qs.join(" | ").toLowerCase();
    assert.match(blob, /masjid jamek sungai rusa/);
    assert.equal(qs.some((q) => /\bdepan\b/i.test(q)), false);
  });
});

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

describe("forwardGeocodeCandidates", () => {
  it("tries later queries when the first Nominatim search is empty", async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      const q = new URL(url).searchParams.get("q");
      seen.push(q);
      const hits =
        q === "lotus kepala batas Penang"
          ? [
              {
                lat: "5.5169",
                lon: "100.4425",
                display_name: "Lotus's, Kepala Batas, Penang",
                address: { suburb: "Kepala Batas" },
              },
            ]
          : [];
      return { ok: true, json: async () => hits };
    };
    const hit = await forwardGeocodeCandidates(
      [
        "traffik light lotus kepala batas",
        "lotus kepala batas Penang",
      ],
      { fetchImpl, userAgent: "test" }
    );
    assert.equal(hit.lat, 5.5169);
    assert.deepEqual(seen, [
      "traffik light lotus kepala batas",
      "lotus kepala batas Penang",
    ]);
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

describe("resolveCitizenPlace", () => {
  it("geocodes a cleaned landmark when the LLM query is empty", async () => {
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
                    '{"ok":false,"searchQuery":"","areaHint":"unknown","confidence":0}',
                },
              },
            ],
          }),
        };
      }
      const q = new URL(href).searchParams.get("q") || "";
      if (/masjid jamek sungai rusa/i.test(q)) {
        return {
          ok: true,
          json: async () => [
            {
              lat: "5.3837",
              lon: "100.2133",
              display_name: "Masjid Jamek Sungai Rusa, Penang",
              address: { village: "Sungai Rusa" },
            },
          ],
        };
      }
      return { ok: true, json: async () => [] };
    };
    const hit = await resolveCitizenPlace("depan masjid jamek sungai rusa", {
      apiKey: "sk-test",
      fetchImpl,
      userAgent: "test",
      skipDb: true,
    });
    assert.ok(hit);
    assert.equal(hit.lat, 5.3837);
    assert.match(hit.display_name, /Sungai Rusa/);
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
