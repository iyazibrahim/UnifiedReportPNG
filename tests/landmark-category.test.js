import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyWorshipFromName,
  classifyWorshipCategory,
  mapOsmCategory,
  reclassifySeedCategory,
} from "../src/location/landmarkCategory.js";

describe("classifyWorshipFromName", () => {
  it("maps masjid / surau", () => {
    assert.equal(classifyWorshipFromName("Masjid Kapitan Keling"), "masjid");
    assert.equal(classifyWorshipFromName("Surau Taman Sri Nibong"), "masjid");
  });

  it("maps temples and tokong", () => {
    assert.equal(classifyWorshipFromName("Kek Lok Si Temple"), "temple");
    assert.equal(classifyWorshipFromName("Tokong Snake Temple"), "temple");
    assert.equal(classifyWorshipFromName("Arulmigu Sri Maha Mariamman Temple"), "temple");
    assert.equal(classifyWorshipFromName("Fo Guang Shan Penang"), "temple");
  });

  it("maps churches", () => {
    assert.equal(classifyWorshipFromName("Church of the Assumption"), "church");
    assert.equal(classifyWorshipFromName("Gereja St George"), "church");
    assert.equal(classifyWorshipFromName("Chruch Of Glory"), "church");
  });

  it("maps shrine and gurdwara", () => {
    assert.equal(classifyWorshipFromName("Dato Koyah Shrine"), "shrine");
    assert.equal(classifyWorshipFromName("Datuk Gong"), "shrine");
    assert.equal(classifyWorshipFromName("Gudwarah Sahib Bayan Baru"), "gurdwara");
  });

  it("falls back to place_of_worship", () => {
    assert.equal(classifyWorshipFromName("Beng Hock Sean Siah"), "place_of_worship");
  });
});

describe("classifyWorshipCategory (OSM tags)", () => {
  it("uses religion tags", () => {
    assert.equal(
      classifyWorshipCategory({ religion: "muslim", name: "X" }),
      "masjid"
    );
    assert.equal(
      classifyWorshipCategory({ religion: "buddhist", name: "X" }),
      "temple"
    );
    assert.equal(
      classifyWorshipCategory({ religion: "hindu", name: "X" }),
      "temple"
    );
    assert.equal(
      classifyWorshipCategory({ religion: "christian", name: "X" }),
      "church"
    );
    assert.equal(
      classifyWorshipCategory({ religion: "sikh", name: "X" }),
      "gurdwara"
    );
  });

  it("uses historic shrine", () => {
    assert.equal(
      classifyWorshipCategory({ historic: "shrine", name: "Local shrine" }),
      "shrine"
    );
  });
});

describe("mapOsmCategory", () => {
  it("does not map all place_of_worship to masjid", () => {
    assert.equal(
      mapOsmCategory({
        amenity: "place_of_worship",
        religion: "buddhist",
        name: "Buddhist Temple",
      }),
      "temple"
    );
    assert.equal(
      mapOsmCategory({ amenity: "school", name: "SMK Test" }),
      "school"
    );
  });
});

describe("reclassifySeedCategory", () => {
  it("fixes mislabeled masjid temples", () => {
    assert.equal(
      reclassifySeedCategory({
        name: "Kek Lok Si Temple",
        category: "masjid",
      }),
      "temple"
    );
    assert.equal(
      reclassifySeedCategory({
        name: "Masjid Kapitan Keling",
        category: "masjid",
      }),
      "masjid"
    );
  });
});
