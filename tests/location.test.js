import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  captureTruth,
  needsMapPick,
  applyLabel,
  confirmLocation,
  replaceTruth,
  addLandmark,
} from "../src/location/model.js";

describe("location truth/confirm/label", () => {
  it("captures current GPS as telegram_current when accuracy is present", () => {
    const truth = captureTruth({
      latitude: 5.4141,
      longitude: 100.3288,
      horizontal_accuracy: 12,
    });
    assert.equal(truth.lat, 5.4141);
    assert.equal(truth.lng, 100.3288);
    assert.equal(truth.accuracy_m, 12);
    assert.equal(truth.source, "telegram_current");
    assert.equal(truth.confirmed, false);
  });

  it("captures map pick as telegram_picked when accuracy is absent", () => {
    const truth = captureTruth({
      latitude: 5.297,
      longitude: 100.277,
    });
    assert.equal(truth.source, "telegram_picked");
    assert.equal(truth.accuracy_m, null);
  });

  it("asks for map pick when current GPS accuracy is worse than 80 m", () => {
    const coarse = captureTruth({
      latitude: 5.4141,
      longitude: 100.3288,
      horizontal_accuracy: 120,
    });
    const fine = captureTruth({
      latitude: 5.4141,
      longitude: 100.3288,
      horizontal_accuracy: 25,
    });
    assert.equal(needsMapPick(coarse), true);
    assert.equal(needsMapPick(fine), false);
  });

  it("does not overwrite truth coordinates when applying a geocode label", () => {
    const truth = captureTruth({
      latitude: 5.4141,
      longitude: 100.3288,
      horizontal_accuracy: 10,
    });
    const labeled = applyLabel(truth, {
      display_name: "Jalan Sultan Ahmad Shah, George Town",
      road: "Jalan Sultan Ahmad Shah",
      lat: 5.5,
      lng: 100.5,
      raw: { place_id: 1 },
    });
    assert.equal(labeled.lat, 5.4141);
    assert.equal(labeled.lng, 100.3288);
    assert.equal(labeled.display_name, "Jalan Sultan Ahmad Shah, George Town");
    assert.equal(labeled.road, "Jalan Sultan Ahmad Shah");
  });

  it("locks confirm without changing truth", () => {
    const labeled = applyLabel(
      captureTruth({ latitude: 5.41, longitude: 100.32 }),
      { display_name: "x", road: "y" }
    );
    const confirmed = confirmLocation(labeled, "button_yes");
    assert.equal(confirmed.confirmed, true);
    assert.ok(confirmed.confirmed_at);
    assert.equal(confirmed.method, "button_yes");
    assert.equal(confirmed.lat, labeled.lat);
    assert.equal(confirmed.lng, labeled.lng);
  });

  it("replaces truth and resets confirm on re-pin", () => {
    const first = confirmLocation(
      applyLabel(captureTruth({ latitude: 5.41, longitude: 100.32 }), {
        display_name: "old",
      }),
      "button_yes"
    );
    const next = replaceTruth(
      captureTruth({ latitude: 5.3, longitude: 100.27 })
    );
    assert.equal(next.lat, 5.3);
    assert.equal(next.confirmed, false);
    assert.equal(next.confirmed_at, null);
    assert.notEqual(next.lat, first.lat);
  });

  it("adds landmark without replacing coordinates", () => {
    const confirmed = confirmLocation(
      applyLabel(captureTruth({ latitude: 5.41, longitude: 100.32 }), {
        display_name: "x",
      }),
      "button_yes_plus_landmark"
    );
    const withLandmark = addLandmark(confirmed, "hadapan 7-Eleven");
    assert.equal(withLandmark.landmark, "hadapan 7-Eleven");
    assert.equal(withLandmark.lat, 5.41);
    assert.equal(withLandmark.lng, 100.32);
  });
});
