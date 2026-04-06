/**
 * Unit tests for the idempotency middleware.
 *
 * Tests run fully offline — in-memory cache only, no DB, no network.
 * The middleware module-level setInterval is safely unref'd so it does not
 * keep the Bun test runner alive after all tests complete.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-for-unit-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';

// Silence logger output
mock.module('../lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

// Stub the DB module — idempotency does NOT use the DB (in-memory only),
// but it imports from '../db/index.js' at the module level via drizzle sql.
mock.module('../db', () => ({
  db: {
    execute: async () => [],
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
}));

mock.module('drizzle-orm', () => ({ sql: () => ({}) }));

import { idempotencyMiddleware } from '../middleware/idempotency';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method: string, key?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (key) headers.set('X-Idempotency-Key', key);
  return new Request('http://localhost/api/test', { method, headers });
}

function makeStore(userId = 'user-123'): Record<string, unknown> {
  return { session: { userId } };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('idempotencyMiddleware', () => {
  let middleware: ReturnType<typeof idempotencyMiddleware>;

  beforeEach(() => {
    // Fresh middleware instance clears any stale in-memory state.
    // (The exported function creates references to the module-level memCache —
    // we clear it by cycling through the lifecycle with a unique resource name.)
    middleware = idempotencyMiddleware('test-' + Math.random().toString(36).slice(2));
  });

  // ── 1. Non-POST requests are ignored ─────────────────────────────────────
  it('ignores GET requests even when X-Idempotency-Key is present', async () => {
    const store = makeStore();
    const set: { status?: number } = {};
    const result = await middleware.beforeHandle({ request: makeRequest('GET', 'key-001'), set, store });
    expect(result).toBeUndefined();
    expect(store._idempotencyKey).toBeUndefined();
  });

  // ── 2. Missing key — no-op ───────────────────────────────────────────────
  it('passes through POST requests that have no X-Idempotency-Key header', async () => {
    const store = makeStore();
    const set: { status?: number } = {};
    const result = await middleware.beforeHandle({ request: makeRequest('POST'), set, store });
    expect(result).toBeUndefined();
    expect(store._idempotencyKey).toBeUndefined();
  });

  // ── 3. First request is a cache miss ─────────────────────────────────────
  it('cache miss: sets _idempotencyKey in store and returns undefined (handler runs)', async () => {
    const store = makeStore();
    const set: { status?: number } = {};
    const result = await middleware.beforeHandle({ request: makeRequest('POST', 'key-first'), set, store });
    expect(result).toBeUndefined();
    expect(typeof store._idempotencyKey).toBe('string');
    expect((store._idempotencyKey as string).includes('key-first')).toBe(true);
  });

  // ── 4. afterHandle caches a 2xx response ─────────────────────────────────
  it('afterHandle caches a 200 response body', async () => {
    const store = makeStore();
    const set: { status?: number } = {};

    // Simulate beforeHandle (cache miss)
    await middleware.beforeHandle({ request: makeRequest('POST', 'key-cache'), set, store });

    // Simulate afterHandle (handler produced a response)
    const responseBody = { ok: true, id: 'abc123' };
    await middleware.afterHandle({ store, response: responseBody });

    // A second request with the same key should now be a cache hit
    const store2 = makeStore(); // same userId via makeStore default
    const set2: { status?: number } = {};
    const cachedResult = await middleware.beforeHandle({ request: makeRequest('POST', 'key-cache'), set2, store: store2 });
    expect(cachedResult).toEqual(responseBody);
    expect(store2._idempotencyHit).toBeDefined();
  });

  // ── 5. Different users get different cache namespaces ─────────────────────
  it('two different users with the same key do NOT share a cache entry', async () => {
    const storeA = makeStore('user-alice');
    const storeB = makeStore('user-bob');
    const set: { status?: number } = {};

    // Alice primes a cache entry
    await middleware.beforeHandle({ request: makeRequest('POST', 'shared-key'), set, store: storeA });
    await middleware.afterHandle({ store: storeA, response: { data: 'alice' } });

    // Bob with the same key should NOT see Alice's response
    const setB: { status?: number } = {};
    const result = await middleware.beforeHandle({ request: makeRequest('POST', 'shared-key'), set: setB, store: storeB });
    expect(result).toBeUndefined();
    expect(storeB._idempotencyHit).toBeUndefined();
  });

  // ── 6. Oversized key is rejected ────────────────────────────────────────
  it('returns 400 if the idempotency key exceeds 64 characters', async () => {
    const store = makeStore();
    const set: { status?: number } = {};
    const longKey = 'x'.repeat(65);
    const result = await middleware.beforeHandle({ request: makeRequest('POST', longKey), set, store });
    expect(set.status).toBe(400);
    expect((result as { error: string })?.error).toContain('64');
  });

  // ── 7. 4xx responses are NOT cached ──────────────────────────────────────
  it('afterHandle does not cache a 4xx response', async () => {
    const store = makeStore();
    const set: { status?: number } = {};
    await middleware.beforeHandle({ request: makeRequest('POST', 'key-4xx'), set, store });

    // Simulate a 400 response
    const errorBody = { error: 'Validation failed' };
    const responseWith400 = { ...errorBody, status: 400 };
    await middleware.afterHandle({ store, response: responseWith400 });

    // Second request should NOT be served from cache
    const store2 = makeStore();
    const set2: { status?: number } = {};
    const result = await middleware.beforeHandle({ request: makeRequest('POST', 'key-4xx'), set: set2, store: store2 });
    expect(result).toBeUndefined();
    expect(store2._idempotencyHit).toBeUndefined();
  });

  // ── 8. afterHandle no-ops when there is no pending key ───────────────────
  it('afterHandle is a no-op when beforeHandle was bypassed (no _idempotencyKey)', async () => {
    const store: Record<string, unknown> = {}; // no _idempotencyKey set
    // Should not throw
    await middleware.afterHandle({ store, response: { ok: true } });
    expect(store._idempotencyHit).toBeUndefined();
  });
});
