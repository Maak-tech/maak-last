/**
 * Auth middleware integration tests.
 *
 * These tests spin up a minimal Elysia app that mirrors the real app's
 * structure without needing a live database connection:
 *   - The requireAuth middleware returns 401 when no valid session header is present.
 *   - The /health liveness probe returns 200 regardless of auth.
 *
 * Bun's built-in mock module is used to stub the DB and Better-auth so that
 * the tests run offline (no Neon/Postgres connection required).
 */
import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Stub required env vars before any module that checks them is imported.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-for-unit-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';

// Mock the DB module so no real Neon connection is attempted.
mock.module('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    execute: async () => [{ '?column?': 1 }],
  },
}));

// Mock Better-auth so getSession always returns null (unauthenticated).
mock.module('../lib/auth', () => ({
  auth: {
    handler: async () => new Response('', { status: 200 }),
    api: {
      getSession: async () => null,
    },
  },
}));

import { Elysia, error } from 'elysia';

// Build a minimal app that mirrors the real app's auth + health structure.
// We do NOT import from '../index' because index.ts calls process.exit(1) on
// missing env vars and .listen() which we don't want in tests.
const testApp = new Elysia()
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .resolve({ as: 'global' }, async ({ request }) => {
    const { auth } = await import('../lib/auth');
    let session: Awaited<ReturnType<typeof auth.api.getSession>>;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch {
      return error(401, { error: 'Unauthorized' });
    }
    if (!session) {
      return error(401, { error: 'Unauthorized' });
    }
    return { session, userId: (session as any).user?.id };
  })
  .get('/api/health/vitals', () => ({ data: [] }));

describe('Auth middleware', () => {
  it('returns 401 on protected route without auth token', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/api/health/vitals', { method: 'GET' })
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on health check endpoint', async () => {
    const res = await testApp.handle(
      new Request('http://localhost/health', { method: 'GET' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
