/**
 * Limits failed sign-in attempts so passwords cannot be guessed.
 * After `max` failures within `windowMs`, that key is locked for `lockMs`.
 * This is in memory (fine for one server). Move it to the database or Redis
 * when we run more than one API server.
 */
export function createLimiter({ max = 5, windowMs = 15 * 60_000, lockMs = 15 * 60_000, now = () => Date.now() } = {}) {
  const state = new Map();
  return {
    /** @returns {{ allowed: boolean, retryAfterSeconds: number }} */
    check(key) {
      const s = state.get(key);
      if (s?.lockedUntil && s.lockedUntil > now())
        return { allowed: false, retryAfterSeconds: Math.ceil((s.lockedUntil - now()) / 1000) };
      return { allowed: true, retryAfterSeconds: 0 };
    },
    fail(key) {
      const t = now();
      let s = state.get(key);
      if (!s || t - s.first > windowMs) s = { first: t, count: 0, lockedUntil: 0 };
      s.count += 1;
      if (s.count >= max) {
        s.lockedUntil = t + lockMs;
        s.count = 0;
        s.first = t;
      }
      state.set(key, s);
    },
    reset(key) {
      state.delete(key);
    },
  };
}
