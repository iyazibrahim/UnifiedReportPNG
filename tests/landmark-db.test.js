import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locateDaerah, daerahLabel } from "../src/jurisdiction/daerah.js";
import {
  isAllowedPenangLocation,
  PENANG_BUFFER_M,
} from "../src/jurisdiction/boundary.js";
import {
  matchLandmarkList,
  scoreLandmarkMatch,
} from "../src/location/matchLandmark.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../data/landmarks.seed.json"),
    "utf8"
  )
);

describe("locateDaerah", () => {
  it("labels Sungai Rusa as Barat Daya not Timur Laut", () => {
    const id = locateDaerah(5.3837118, 100.2132602);
    assert.equal(id, "barat_daya");
    assert.equal(daerahLabel(id), "Barat Daya");
  });

  it("labels Komtar area as Timur Laut", () => {
    assert.equal(locateDaerah(5.4145, 100.3292), "timur_laut");
  });

  it("labels Kepala Batas / Bertam as SPU", () => {
    assert.equal(locateDaerah(5.5169, 100.4425), "spu");
  });
});

describe("isAllowedPenangLocation", () => {
  it("allows pins inside Pulau Pinang", () => {
    const r = isAllowedPenangLocation(5.4145, 100.3292);
    assert.equal(r.allowed, true);
    assert.equal(r.reason, "inside");
  });

  it("rejects far pins (Kuala Lumpur)", () => {
    const r = isAllowedPenangLocation(3.139, 101.6869);
    assert.equal(r.allowed, false);
    assert.equal(r.reason, "too_far");
    assert.ok(r.distanceM > PENANG_BUFFER_M);
  });

  it("allows near-boundary buffer (~3km)", () => {
    // Slightly west of island ring (~100.15)
    const r = isAllowedPenangLocation(5.35, 100.14);
    assert.equal(r.allowed, true);
    assert.ok(r.reason === "inside" || r.reason === "buffer");
  });
});

describe("matchLandmarkList", () => {
  it("matches depan masjid jamek sungai rusa from seed", () => {
    const hit = matchLandmarkList("depan masjid jamek sungai rusa", seed);
    assert.ok(hit);
    assert.match(hit.landmark.name, /Sungai Rusa/i);
    assert.equal(hit.landmark.daerah, "barat_daya");
  });

  it("matches traffic light near lotus kepala batas", () => {
    const hit = matchLandmarkList(
      "traffik light berdekatan lotus kepala batas / bertam",
      seed
    );
    assert.ok(hit);
    assert.match(hit.landmark.name, /Lotus/i);
  });

  it("scores exact alias highly", () => {
    const lm = seed.find((x) => /Sungai Rusa/i.test(x.name));
    assert.ok(scoreLandmarkMatch("masjid jamek sungai rusa", lm) >= 0.9);
  });
});

describe("landmarks seed fixture", () => {
  it("has curated entries with daerah for CI dry-run", () => {
    assert.ok(seed.length >= 10);
    assert.ok(seed.every((x) => x.name && Number.isFinite(x.lat)));
    assert.ok(seed.some((x) => x.daerah === "barat_daya"));
  });
});
