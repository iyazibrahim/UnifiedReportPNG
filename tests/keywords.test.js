import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyByKeywords } from "../src/classify/keywords.js";

describe("classifyByKeywords", () => {
  it("detects rubbish as kebersihan", () => {
    const result = classifyByKeywords("Tong sampah penuh depan rumah");
    assert.equal(result.categoryId, "kebersihan");
    assert.equal(result.method, "rules");
  });

  it("detects pothole as jalan", () => {
    const result = classifyByKeywords("Jalan berlubang besar dekat sini");
    assert.equal(result.categoryId, "jalan");
  });

  it("detects water leak as bekalan_air", () => {
    const result = classifyByKeywords("Paip pecah, tiada air");
    assert.equal(result.categoryId, "bekalan_air");
  });

  it("falls back to lain_lain when nothing matches", () => {
    const result = classifyByKeywords("asdf qwer");
    assert.equal(result.categoryId, "lain_lain");
    assert.ok(result.confidence < 0.5);
  });
});
