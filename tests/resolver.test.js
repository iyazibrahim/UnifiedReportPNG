import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveJurisdiction } from "../src/jurisdiction/resolver.js";

const PULAU = { lat: 5.4141, lng: 100.3288 };
const SEBERANG = { lat: 5.3634, lng: 100.4589 };
const OUTSIDE = { lat: 3.139, lng: 101.6869 };

describe("resolveJurisdiction", () => {
  it("routes kebersihan on the island to Pearl MBPP", () => {
    const result = resolveJurisdiction({
      categoryId: "kebersihan",
      ...PULAU,
    });
    assert.equal(result.agencyId, "pearl_mbpp");
    assert.equal(result.needsTriage, false);
    assert.match(result.reason, /MBPP|pulau|Pulau/i);
  });

  it("routes kebersihan on the mainland to Aspire MBSP", () => {
    const result = resolveJurisdiction({
      categoryId: "kebersihan",
      ...SEBERANG,
    });
    assert.equal(result.agencyId, "aspire_mbsp");
    assert.match(result.reason, /MBSP|Seberang/i);
  });

  it("routes bekalan_air to PBAPP regardless of side", () => {
    const island = resolveJurisdiction({ categoryId: "bekalan_air", ...PULAU });
    const mainland = resolveJurisdiction({
      categoryId: "bekalan_air",
      ...SEBERANG,
    });
    assert.equal(island.agencyId, "pbapp");
    assert.equal(mainland.agencyId, "pbapp");
  });

  it("routes lampu_isyarat to MyJalan", () => {
    const result = resolveJurisdiction({
      categoryId: "lampu_isyarat",
      ...PULAU,
    });
    assert.equal(result.agencyId, "myjalan");
  });

  it("prefers local council for a local jalan pin", () => {
    const result = resolveJurisdiction({
      categoryId: "jalan",
      ...PULAU,
      label: { display_name: "Lorong Maktab, George Town", road: "Lorong Maktab" },
    });
    assert.equal(result.agencyId, "pearl_mbpp");
  });

  it("routes major-road jalan to MyJalan even on the island", () => {
    const result = resolveJurisdiction({
      categoryId: "jalan",
      ...PULAU,
      label: {
        display_name: "Lebuhraya Tun Dr Lim Chong Eu",
        road: "Lebuhraya Tun Dr Lim Chong Eu",
      },
    });
    assert.equal(result.agencyId, "myjalan");
  });

  it("does not use road label when routing kebersihan", () => {
    const result = resolveJurisdiction({
      categoryId: "kebersihan",
      ...PULAU,
      label: { display_name: "Lebuhraya PLUS", road: "Lebuhraya PLUS" },
    });
    assert.equal(result.agencyId, "pearl_mbpp");
  });

  it("sends banjir and lain_lain to ePINTAS triage", () => {
    const flood = resolveJurisdiction({ categoryId: "banjir", ...SEBERANG });
    const other = resolveJurisdiction({ categoryId: "lain_lain", ...PULAU });
    assert.equal(flood.agencyId, "epintas");
    assert.equal(flood.needsTriage, true);
    assert.equal(other.agencyId, "epintas");
    assert.equal(other.needsTriage, true);
  });

  it("sends PBT categories outside Penang to ePINTAS triage", () => {
    const result = resolveJurisdiction({
      categoryId: "pokok",
      ...OUTSIDE,
    });
    assert.equal(result.agencyId, "epintas");
    assert.equal(result.needsTriage, true);
  });
});
