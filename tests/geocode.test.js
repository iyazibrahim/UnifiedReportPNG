import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reverseGeocode, rankNominatimHits } from "../src/location/geocode.js";
import { applyLabel, captureTruth } from "../src/location/model.js";

describe("rankNominatimHits", () => {
  it("prefers shop POI over administrative town when query has mart token", () => {
    const rows = [
      {
        lat: "5.3485",
        lon: "100.2295",
        type: "town",
        class: "place",
        importance: 0.5,
        display_name: "Balik Pulau",
      },
      {
        lat: "5.3507",
        lon: "100.2378",
        type: "supermarket",
        class: "shop",
        importance: 0.3,
        display_name: "TF Mart, Balik Pulau",
      },
    ];
    const ranked = rankNominatimHits(rows, "TF Mart Balik Pulau");
    assert.match(ranked[0].display_name, /TF Mart/i);
  });
});

describe("reverseGeocode", () => {
  it("maps Nominatim fields into a label without becoming location truth", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        display_name: "Jalan Penang, George Town",
        lat: "9.0000",
        lon: "9.0000",
        address: { road: "Jalan Penang", city: "George Town" },
      }),
    });
    const label = await reverseGeocode(5.4141, 100.3288, { fetchImpl });
    const truth = captureTruth({ latitude: 5.4141, longitude: 100.3288 });
    const merged = applyLabel(truth, label);
    assert.equal(merged.lat, 5.4141);
    assert.equal(merged.lng, 100.3288);
    assert.equal(merged.road, "Jalan Penang");
    assert.notEqual(String(merged.lat), "9.0000");
  });
});
