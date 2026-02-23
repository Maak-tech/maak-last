/**
 * API Key Authentication Middleware
 *
 * Validates API keys for the public REST API.
 * Keys are stored as SHA-256 hashes in organizations/{orgId}/apiKeys/{keyId}.
 * The request must include:
 *   Authorization: Bearer mk_live_<key>
 *   X-Org-Id: <orgId>
 */

import { createHash } from "crypto";
import type { Request, Response } from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "../observability/logger";
import { createTraceId } from "../observability/correlation";

const db = () => getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiAuthContext = {
  orgId: string;
  keyId: string;
  scopes: string[];
  rateLimit: number;
};

export type ApiRequest = Request & {
  apiAuth?: ApiAuthContext;
  traceId?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function extractApiKey(req: Request): string | null {
  // Accept Authorization: Bearer <key> or X-API-Key: <key>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("mk_live_")) return token;
  }

  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  if (apiKeyHeader?.startsWith("mk_live_")) return apiKeyHeader;

  return null;
}

function extractOrgId(req: Request): string | null {
  const orgIdHeader = req.headers["x-org-id"] as string | undefined;
  return orgIdHeader ?? null;
}

// ─── Rate Limiting (simple in-memory, resets per function instance) ───────────

const requestCounts = new Map<
  string,
  { count: number; windowStart: number }
>();

function checkRateLimit(keyId: string, rateLimit: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const entry = requestCounts.get(keyId);

  if (!entry || now - entry.windowStart > windowMs) {
    requestCounts.set(keyId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= rateLimit) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Authenticate the request using an API key.
 * Attaches `req.apiAuth` if successful.
 * Sends 401/403/429 responses directly on failure.
 * Returns true if authenticated, false if response already sent.
 */
export async function authenticateApiKey(
  req: ApiRequest,
  res: Response,
  requiredScopes?: string[]
): Promise<boolean> {
  const traceId = createTraceId();
  req.traceId = traceId;

  const rawKey = extractApiKey(req);
  const orgId = extractOrgId(req);

  if (!rawKey) {
    res.status(401).json({
      error: "Missing API key",
      code: "unauthorized",
      hint: "Include Authorization: Bearer mk_live_<key> or X-API-Key header",
    });
    return false;
  }

  if (!orgId) {
    res.status(400).json({
      error: "Missing X-Org-Id header",
      code: "bad_request",
    });
    return false;
  }

  const keyHash = hashKey(rawKey);

  try {
    // Look up key by hash in org's apiKeys subcollection
    const snap = await db()
      .collection("organizations")
      .doc(orgId)
      .collection("apiKeys")
      .where("keyHash", "==", keyHash)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snap.empty) {
      logger.warn("Invalid or revoked API key", {
        traceId,
        orgId,
        keyPrefix: rawKey.slice(0, 16),
        fn: "authenticateApiKey",
      });
      res.status(401).json({
        error: "Invalid or revoked API key",
        code: "unauthorized",
      });
      return false;
    }

    const keyDoc = snap.docs[0];
    const keyData = keyDoc.data();

    // Check expiry
    if (keyData.expiresAt) {
      const expiresAt = keyData.expiresAt.toDate?.() ?? new Date(keyData.expiresAt);
      if (expiresAt < new Date()) {
        res.status(401).json({
          error: "API key expired",
          code: "unauthorized",
        });
        return false;
      }
    }

    // Check scopes
    const keyScopes: string[] = keyData.scopes ?? [];
    if (requiredScopes && requiredScopes.length > 0) {
      const missing = requiredScopes.filter((s) => !keyScopes.includes(s));
      if (missing.length > 0) {
        res.status(403).json({
          error: "Insufficient API key scopes",
          code: "forbidden",
          required: requiredScopes,
          granted: keyScopes,
        });
        return false;
      }
    }

    // Check rate limit
    const rateLimit: number = keyData.rateLimit ?? 100;
    if (!checkRateLimit(keyDoc.id, rateLimit)) {
      res.status(429).json({
        error: "Rate limit exceeded",
        code: "too_many_requests",
        limit: rateLimit,
        window: "60s",
        retryAfter: 60,
      });
      return false;
    }

    // Attach auth context to request
    req.apiAuth = {
      orgId,
      keyId: keyDoc.id,
      scopes: keyScopes,
      rateLimit,
    };

    // Update lastUsedAt asynchronously (don't block the request)
    keyDoc.ref
      .update({ lastUsedAt: FieldValue.serverTimestamp() })
      .catch(() => {});

    return true;
  } catch (err) {
    logger.error("API key authentication error", err as Error, {
      traceId,
      orgId,
      fn: "authenticateApiKey",
    });
    res.status(500).json({
      error: "Authentication service error",
      code: "internal",
    });
    return false;
  }
}

/**
 * Check if the authenticated key has a specific scope.
 */
export function hasScope(
  req: ApiRequest,
  scope: string
): boolean {
  return req.apiAuth?.scopes.includes(scope) ?? false;
}

/**
 * Assert scope or send 403.
 * Returns true if has scope, false if 403 was sent.
 */
export function assertScope(
  req: ApiRequest,
  res: Response,
  scope: string
): boolean {
  if (!hasScope(req, scope)) {
    res.status(403).json({
      error: `Requires scope: ${scope}`,
      code: "forbidden",
    });
    return false;
  }
  return true;
}
