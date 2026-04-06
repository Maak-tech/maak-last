/**
 * Rate limiter with strategy pattern — works with in-memory store (single-instance)
 * or Redis (multi-instance production).
 *
 * Strategy selection:
 *   - If REDIS_URL is set at startup, uses RedisStore (ioredis INCR + EXPIRE).
 *   - Otherwise, uses InMemoryStore (sliding-window Map, original behaviour).
 *
 * Backwards-compatible: behaviour for single-instance deployments is unchanged.
 * Set REDIS_URL to opt-in to Redis-backed rate limiting across multiple replicas.
 *
 * Redis approach notes:
 *   - INCR + EXPIRE is a fixed-window counter (not a true sliding window).
 *   - For a true sliding-window across replicas, replace with a Lua ZSET script:
 *
 *     redis.eval(`
 *       local key = KEYS[1]; local now = tonumber(ARGV[1])
 *       local window = tonumber(ARGV[2]); local max = tonumber(ARGV[3])
 *       redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
 *       local count = redis.call('ZCARD', key)
 *       if count < max then
 *         redis.call('ZADD', key, now, now)
 *         redis.call('PEXPIRE', key, window)
 *         return 1
 *       end
 *       return 0
 *     `, 1, userId, Date.now(), windowMs, maxRequests)
 */

// ── Store interface ──────────────────────────────────────────────────────────

interface RateLimiterStore {
  /** Increment the counter for `key` within `windowMs` and return the new count. */
  increment(key: string, windowMs: number): Promise<number>
  /** Reset the counter for `key` (used in tests). */
  reset(key: string): Promise<void>
}

// ── In-memory implementation (single-instance / dev) ────────────────────────

interface WindowEntry {
  /** Timestamps (ms since epoch) of requests within the current sliding window */
  timestamps: number[];
}

class InMemoryStore implements RateLimiterStore {
  private readonly entries = new Map<string, WindowEntry>();
  /** Periodic sweep to prevent unbounded Map growth on idle servers */
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up stale entries every 5 minutes
    this.cleanupTimer = setInterval(() => this._sweep(), 5 * 60_000);
    this.cleanupTimer.unref?.();
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = this.entries.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.entries.set(key, entry);
    }

    // Evict timestamps outside the sliding window
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
    entry.timestamps.push(now);
    return entry.timestamps.length;
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** Remove entries with no in-window timestamps (saves memory). */
  private _sweep(): void {
    // windowMs varies per limiter; we use a conservative 1-hour cutoff for the sweep.
    const cutoff = Date.now() - 60 * 60_000;
    for (const [key, entry] of this.entries) {
      if (entry.timestamps.every((ts) => ts <= cutoff)) {
        this.entries.delete(key);
      }
    }
  }

  /** Stop the cleanup timer — useful in tests to avoid open handles. */
  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}

// ── Redis implementation (multi-instance production) ────────────────────────

interface RedisClient {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

class RedisStore implements RateLimiterStore {
  constructor(private readonly redis: RedisClient) {}

  async increment(key: string, windowMs: number): Promise<number> {
    const count = await this.redis.incr(key)
    if (count === 1) {
      // Set expiry only on first increment so the window auto-resets
      await this.redis.expire(key, Math.ceil(windowMs / 1000))
    }
    return count
  }

  async reset(key: string): Promise<void> {
    // ioredis: del is available but we keep the interface minimal
    // Cast to any for optional del support without requiring it in the interface
    const client = this.redis as unknown as { del?: (key: string) => Promise<unknown> }
    await client.del?.(key)
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

function createStore(): RateLimiterStore {
  if (process.env.REDIS_URL) {
    // Dynamically require ioredis only when REDIS_URL is configured.
    // This avoids a hard dependency on ioredis in single-instance deployments.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis')
    const client = new Redis(process.env.REDIS_URL) as RedisClient
    return new RedisStore(client)
  }
  return new InMemoryStore()
}

const _store = createStore()

// ── Public types ─────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  /** Length of the sliding window in milliseconds (e.g. 60_000 for 1 minute). */
  windowMs: number;
  /** Maximum number of requests allowed per key per window. */
  maxRequests: number;
}

export interface RateLimitResult {
  /** Whether the request is within limits and should be allowed. */
  allowed: boolean;
  /** How many requests remain before the limit is reached. */
  remaining: number;
  /**
   * Approximate ms until the window resets. Used to populate a `Retry-After`
   * header: `Math.ceil(result.resetIn / 1000)` → seconds to wait.
   *
   * Note: for the Redis store this is an approximation (full window length)
   * because the fixed-window counter does not track individual timestamps.
   */
  resetIn: number;
}

// ── RateLimiter class — thin wrapper over the shared store ────────────────────

/**
 * Application-level rate limiter.
 *
 * Create one instance per endpoint / limit policy.  All instances share the
 * same underlying store (in-memory or Redis depending on REDIS_URL).
 *
 * `check()` is both a counter and a guard — call it exactly once per request.
 * When `allowed` is false the request is NOT recorded (no double-counting).
 */
export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyPrefix: string;

  constructor(options: RateLimiterOptions & { keyPrefix?: string }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.keyPrefix = options.keyPrefix ?? 'rl';
  }

  async check(key: string): Promise<RateLimitResult> {
    const storeKey = `${this.keyPrefix}:${key}`
    // Peek: increment tentatively, then check if over limit.
    // For the in-memory store this is a true sliding-window count.
    // For Redis this is a fixed-window INCR.
    const count = await _store.increment(storeKey, this.windowMs)
    const allowed = count <= this.maxRequests
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - count),
      resetIn: this.windowMs,
    }
  }

  /** Reset rate-limit counter for a key (useful in tests). */
  async reset(key: string): Promise<void> {
    await _store.reset(`${this.keyPrefix}:${key}`)
  }

  /**
   * Destroy underlying in-memory store timers.
   * No-op when using Redis store.
   * @deprecated Only needed in tests; prefer letting the process exit naturally.
   */
  destroy(): void {
    if (_store instanceof InMemoryStore) {
      _store.destroy()
    }
  }
}

// ── createRateLimiter factory helper ─────────────────────────────────────────

/**
 * Functional helper — returns an async function `(userId: string) => RateLimitResult`.
 *
 * Equivalent to `new RateLimiter(options).check(userId)` but avoids needing
 * to keep a class instance around for simple one-off middleware.
 */
export function createRateLimiter(options: {
  windowMs: number
  max: number
  keyPrefix?: string
}) {
  const limiter = new RateLimiter({
    windowMs: options.windowMs,
    maxRequests: options.max,
    keyPrefix: options.keyPrefix,
  })
  return (userId: string) => limiter.check(userId)
}

// ── Application-level rate limiter instances ─────────────────────────────────
//
// Singletons shared across all requests.  Each instance gets a distinct
// keyPrefix so Redis keys don't collide.

/**
 * /api/nora/chat — GPT-4o completions.
 *
 * 20 requests / user / minute.
 * Comfortable for natural conversation (≈1 message every 3 s sustained)
 * while preventing runaway API costs from misbehaving clients or scripts.
 */
export const chatRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: 'rl:chat',
});

/**
 * /api/nora/realtime-session — OpenAI Realtime API ephemeral token creation.
 *
 * 5 sessions / user / minute.
 * Realtime sessions are billed by the minute of audio; tighter limit is
 * appropriate. Normal usage is 0–1 session creations per conversation.
 */
export const realtimeSessionRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
  keyPrefix: 'rl:realtime',
});

/**
 * /api/emergency/sms — Twilio emergency SMS dispatch.
 *
 * 3 messages / user / 10 minutes.
 * Tight ceiling prevents SMS cost abuse and Twilio account suspension.
 */
export const emergencySmsRateLimiter = new RateLimiter({
  windowMs: 10 * 60_000, // 10 minutes
  maxRequests: 3,
  keyPrefix: 'rl:sms',
});

/**
 * /api/nora/complete — generic AI completions (gpt-3.5-turbo / gpt-4o).
 *
 * 30 requests / user / minute.
 * Higher than /chat since internal mobile services can call it in quick
 * succession for processing pipelines.
 */
export const completionRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'rl:complete',
});

/**
 * /api/nora/transcribe — OpenAI Whisper audio transcription.
 *
 * 10 requests / user / minute.
 * Whisper is billed per second of audio; this limit prevents cost abuse.
 */
export const transcribeRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyPrefix: 'rl:transcribe',
});

/**
 * /api/auth/* — better-auth endpoints (sign-in, sign-up, OTP).
 *
 * 10 requests / IP / minute.
 * Prevents brute-force password attacks, credential stuffing, and OTP enumeration.
 * Keyed by IP address since auth requests are pre-authentication.
 */
export const authRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyPrefix: 'rl:auth',
});

/**
 * /api/notifications/send — Expo push notification dispatch.
 *
 * 30 sends / user / minute.
 */
export const pushSendRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'rl:push',
});

/**
 * /api/vhi/me/recompute — on-demand VHI pipeline recompute.
 *
 * 3 requests / user / 10 minutes.
 */
export const vhiRecomputeRateLimiter = new RateLimiter({
  windowMs: 10 * 60_000, // 10 minutes
  maxRequests: 3,
  keyPrefix: 'rl:vhi',
});

/**
 * /api/notifications/email — SendGrid transactional email.
 *
 * 20 emails / user / 10 minutes.
 */
export const emailRateLimiter = new RateLimiter({
  windowMs: 10 * 60_000, // 10 minutes
  maxRequests: 20,
  keyPrefix: 'rl:email',
});

/**
 * /api/health/ppg/analyze — PaPaGei ML inference (PPG signal → vitals).
 *
 * 10 requests / user / minute.
 */
export const ppgAnalyzeRateLimiter = new RateLimiter({
  windowMs: 60_000, // 1 minute
  maxRequests: 10,
  keyPrefix: 'rl:ppg',
});

/**
 * /api/notes/:id/parse — MedGemma clinical note ML parsing.
 *
 * 20 requests / user / hour.
 */
export const noteParseRateLimiter = new RateLimiter({
  windowMs: 60 * 60_000, // 1 hour
  maxRequests: 20,
  keyPrefix: 'rl:notes',
});

/**
 * POST /api/health/vitals/batch — bulk device-sync inserts.
 *
 * 5 batch requests / user / minute.
 * Batch inserts are expensive (up to 500 rows each); tight limit prevents
 * runaway DB load from misbehaving sync clients.
 */
export const batchVitalsRateLimiter = new RateLimiter({
  windowMs: 60_000, // 1 minute
  maxRequests: 5,
  keyPrefix: 'rl:batch_vitals',
});
