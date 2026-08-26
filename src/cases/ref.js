import crypto from "node:crypto";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRef(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replaceAll("-", "");
  const bytes = crypto.randomBytes(4);
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += CHARS[bytes[i] % CHARS.length];
  }
  return `PG-${ymd}-${suffix}`;
}
