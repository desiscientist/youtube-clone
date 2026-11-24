import { NextResponse } from "next/server";

/**
 * A simple in-memory sliding-window rate limiter.
 *
 * It's per server process, which is right for local development and a single
 * server. With several servers, swap the store for Redis or similar so all
 * servers share the counts.
 */

type Rule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  // Per account: 10 tries in 15 minutes. Per IP: looser, since many people
  // can share one address.
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginIp: { limit: 50, windowMs: 15 * 60 * 1000 },
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  comment: { limit: 20, windowMs: 60 * 1000 },
  reaction: { limit: 60, windowMs: 60 * 1000 },
  subscribe: { limit: 30, windowMs: 60 * 1000 },
  report: { limit: 10, windowMs: 60 * 60 * 1000 },
  upload: { limit: 20, windowMs: 60 * 60 * 1000 },
  playlist: { limit: 60, windowMs: 60 * 1000 },
} satisfies Record<string, Rule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const globalStore = globalThis as unknown as {
  rateLimitHits?: Map<string, number[]>;
};
// Survives dev-server hot reloads, like the Prisma client does.
const hits = (globalStore.rateLimitHits ??= new Map<string, number[]>());

let lastSweep = Date.now();

/** Drops expired entries now and then so the map doesn't grow forever. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const longest = Math.max(
    ...Object.values(RATE_LIMITS).map((r) => r.windowMs),
  );
  hits.forEach((times, key) => {
    if (times.length === 0 || now - times[times.length - 1] > longest) {
      hits.delete(key);
    }
  });
}

/**
 * Records one attempt for `key` under `name`'s rule. Returns how many seconds
 * to wait if the limit is exceeded, or 0 if the attempt is allowed.
 */
export function hitRateLimit(name: RateLimitName, key: string) {
  const rule = RATE_LIMITS[name];
  const now = Date.now();
  sweep(now);

  const id = `${name}:${key}`;
  const recent = (hits.get(id) ?? []).filter(
    (time) => now - time < rule.windowMs,
  );
  if (recent.length >= rule.limit) {
    hits.set(id, recent);
    return Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000));
  }
  recent.push(now);
  hits.set(id, recent);
  return 0;
}

/** Forgets earlier attempts, e.g. failed logins after a successful one. */
export function resetRateLimit(name: RateLimitName, key: string) {
  hits.delete(`${name}:${key}`);
}

/** The caller's IP address, as reported by the proxy in front of the app. */
export function clientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Checks the limit and returns a 429 response if it's exceeded, or null.
 * `key` is usually the user id, falling back to the IP address.
 */
export function rateLimitResponse(name: RateLimitName, key: string) {
  const retryAfter = hitRateLimit(name, key);
  if (retryAfter === 0) return null;
  const minutes = Math.ceil(retryAfter / 60);
  return NextResponse.json(
    {
      error:
        retryAfter < 90
          ? `You're doing that too often. Try again in ${retryAfter} seconds.`
          : `You're doing that too often. Try again in ${minutes} minutes.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
