import fs from "node:fs";
import { locateDaerah, daerahLabel } from "../src/jurisdiction/daerah.js";
import { locateRegion } from "../src/jurisdiction/region.js";

const path = new URL("../data/landmarks.seed.json", import.meta.url);
const s = JSON.parse(fs.readFileSync(path, "utf8"));
let fixed = 0;
for (const m of s) {
  if (!m.daerah || m.daerah === "unknown") {
    m.daerah = locateDaerah(m.lat, m.lng);
    fixed += 1;
  }
  let side = m.side || locateRegion(m.lat, m.lng);
  if (side === "outside") {
    side = String(m.daerah).startsWith("sp") ? "seberang" : "pulau";
  }
  m.side = side;
  if (!m.address || /Tidak pasti|unknown/i.test(m.address)) {
    m.address = `${m.name}, ${daerahLabel(m.daerah)}, Pulau Pinang`;
  }
}
fs.writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
const byDaerah = {};
for (const m of s) byDaerah[m.daerah] = (byDaerah[m.daerah] || 0) + 1;
console.log({ fixed, total: s.length, byDaerah });
