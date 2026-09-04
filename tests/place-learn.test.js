import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isGenericPlaceName,
} from "../src/location/learnPlace.js";
import { scoreLandmarkMatch } from "../src/location/matchLandmark.js";

describe("place learning gates", () => {
  it("rejects unnamed / generic place labels", () => {
    assert.equal(isGenericPlaceName(""), true);
    assert.equal(isGenericPlaceName("road"), true);
    assert.equal(isGenericPlaceName("Jalan"), true);
    assert.equal(isGenericPlaceName("Gurney Paragon"), false);
  });

  it("alias-style fuzzy match scores highly", () => {
    const lm = {
      name: "Lotus's Kepala Batas",
      aliases: ["lotus bertam", "lotus kepala batas"],
    };
    assert.ok(scoreLandmarkMatch("lotus bertam", lm) >= 0.9);
  });
});
