import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { locateRegion } from "../src/jurisdiction/region.js";

describe("locateRegion", () => {
  it("maps Komtar (George Town) to pulau", () => {
    assert.equal(locateRegion(5.4141, 100.3288), "pulau");
  });

  it("maps Bayan Lepas to pulau", () => {
    assert.equal(locateRegion(5.297, 100.277), "pulau");
  });

  it("maps Bukit Mertajam to seberang", () => {
    assert.equal(locateRegion(5.3634, 100.4589), "seberang");
  });

  it("maps Butterworth to seberang", () => {
    assert.equal(locateRegion(5.3991, 100.3655), "seberang");
  });

  it("maps Kuala Lumpur to outside", () => {
    assert.equal(locateRegion(3.139, 101.6869), "outside");
  });
});
