import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;

export async function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = await scrypt(String(plain), salt, KEY_LEN);
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(plain, stored) {
  if (!stored || !plain) return false;
  if (!String(stored).startsWith("scrypt:")) {
    return String(plain) === String(stored);
  }
  const [, saltB64, hashB64] = String(stored).split(":");
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(String(plain), salt, expected.length);
  return crypto.timingSafeEqual(derived, expected);
}
