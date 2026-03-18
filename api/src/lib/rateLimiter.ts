/**
 * Sliding-window in-memory rate limiter.
 *
 * Suitable for single-instance Railway deployments.
 *
 * Architecture note: If you scale to multiple Railway replicas, replace this
 * with a Redis-backed implementation using atomic Lua scripting so limits are
 * enforced across all instances rather than per-instance. A drop-in approach:
 *
 *   redis.eval(`
 *     local key = KEYS[1]; local now = tonumber(ARGV[1])
 *     local window = tonumber(ARGV[2]); local max = tonumber(ARGV[3])
 *     redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
 *     local count = redis.call('ZCARD', key)
 *     if count < max then
 *       redis.call('ZADD', key, now, now)
 *       redis.call('PEXPIRE', key, window)
 *       return 1
 *     end
 *     return 0
 *   `, 1, userId, Date.now(), windowMs, maxRequests)
 */

interface WindowEntry {
  /** Timestamps (ms since epoch) of requests within the current sliding window */
  timestamps: number[];
}

export interface RateLimiterOptions {
  /** Length of the sliding window in milliseconds (e.g. 60_000 for 1 minute) */
  windowMs: number;
  /** Maximum number of requests allowed per key per window */
  maxRequests: number;
}

export interface RateLimitResult {
  /** Whether the request is within limits and should be allowed */
  allowed: boolean;
  /** How many requests remain before the limit is reached */
  remaining: number;
  /**
   * Unix timestamp (ms) when the oldest in-window request expires and frees a slot.
   * 0 when the window is empty (i.e. the key has no recent requests).
   * Use this to populate a `Retry-After` header:
   *   Math.ceil((result.resetAt - Date.now()) / 1000)  →  seconds to wait
   */
  resetAt: number;
}

export class RateLimiter {
  private readonly entries = new Map<string, WindowEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  /** Periodic sweep to prevent unbounded Map growth on idle servers */
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // Clean up stale entries every 5 minutes
    this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60_000);
    // Allow the process to exit naturally even when this timer is running
    this.cleanupTimer.unref?.();
  }

  /**
   * Check whether `key` is within its rate limit and record this attempt.
   * This method is both a check and a counter — call it exactly once per request.
   *
   * When `allowed` is false, the request is NOT recorded (no double-counting).
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entry = this.entries.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.entries.set(key, entry);
    }

    // Evict timestamps outside the current sliding window
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

    const currentCount = entry.timestamps.length;
    const allowed = currentCount < this.maxRequests;

    if (allowed) {
      // Only record the request when it is being served
      entry.timestamps.push(now);
    }

    const remaining = Math.max(0, this.maxRequests - entry.timestamps.length);
    // The oldest timestamp in the window — when it expires a slot opens
    const resetAt = entry.timestamps.length > 0 ? entry.timestamps[0] + this.windowMs : 0;

    return { allowed, remaining, resetAt };
  }

  /** Remove entries that have no in-window timestamps (saves memory) */
  private sweep(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, entry] of this.entries) {
      if (entry.timestamps.every((ts) => ts <= cutoff)) {
        this.entries.delete(key);
      }
    }
  }

  /** Stop the cleanup timer — useful in tests to avoid open handles */
  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}

// ── Application-level rate limiter instances ─────────────────────────────────
//
// These are module-level singletons. A single Railway instance handles all
// requests, so one Map per limiter is sufficient. If you add horizontal
// scaling, swap these for the Redis implementation described above.

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
});

/**
 * /api/emergency/sms — Twilio emergency SMS dispatch.
 *
 * 3 messages / user / 10 minutes.
 * Tight ceiling prevents SMS cost abuse and Twilio account suspension.
 * Genuine emergencies rarely require more than one SMS in a 10-minute window —
 * the first message reaches the contact; additional retries add little value
 * while creating significant abuse surface area.
 */
export const emergencySmsRateLimiter = new RateLimiter({
  windowMs: 10 * 60_000, // 10 minutes
  maxRequests: 3,
});

/**
 * /api/nora/complete — generic AI completions (gpt-3.5-turbo / gpt-4o).
 *
 * 30 requests / user / minute.
 * Higher than /chat since internal mobile services (labInsights,
 * symptomPatternRecognition, aiInsights, voiceService) can call it in quick
 * succession for processing pipelines. Still prevents runaway cost from
 * misbehaving or scripted clients.
 */
export const completionRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});

/**
 * /api/nora/transcribe — OpenAI Whisper audio transcription.
 *
 * 10 requests / user / minute.
 * Whisper is billed per second of audio; this limit prevents cost abuse from
 * clients that repeatedly upload audio in a tight loop. Normal voice-note
 * usage rarely exceeds 1–2 transcriptions per minute.
 */
export const transcribeRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
