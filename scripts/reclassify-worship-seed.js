/**
 * One-shot: reclassify worship places in data/landmarks.seed.json
 * that were wrongly labeled category "masjid".
 *
 * Usage: node scripts/reclassify-worship-seed.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reclassifySeedCategory } from "../src/location/landmarkCategory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, "../data/landmarks.seed.json");

function countByCategory(rows) {
  const by = {};
  for (const r of rows) {
    const c = r.category || "landmark";
    by[c] = (by[c] || 0) + 1;
  }
  return by;
}

const raw = fs.readFileSync(SEED_PATH, "utf8");
const rows = JSON.parse(raw);
const before = countByCategory(rows);

let changed = 0;
const samples = [];
for (const row of rows) {
  const prev = row.category;
  const next = reclassifySeedCategory(row);
  if (next !== prev) {
    changed += 1;
    if (samples.length < 25) {
      samples.push({ name: row.name, from: prev, to: next });
    }
    row.category = next;
  }
}

const after = countByCategory(rows);
fs.writeFileSync(SEED_PATH, `${JSON.stringify(rows, null, 2)}\n`, "utf8");

console.log("Before:", before);
console.log("After:", after);
console.log(`Changed: ${changed}`);
console.log("Sample changes:");
for (const s of samples) {
  console.log(`  ${s.from} → ${s.to}: ${s.name}`);
}
