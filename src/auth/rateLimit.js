const buckets = new Map();

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * In-memory login rate limiter (single instance).
 * @returns {{ allowed: boolean, retryAfterSec?: number }}
 */
export function checkLoginRateLimit(
  key,
  { windowMs = DEFAULT_WINDOW_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = {}
) {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    buckets.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > maxAttempts) {
    const retryAfterSec = Math.ceil(
      (entry.start + windowMs - now) / 1000
    );
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

export function resetLoginRateLimit(key) {
  buckets.delete(key);
}

export function clearLoginRateLimits() {
  buckets.clear();
}
