import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApiKey, ApiKeyScope } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function mapApiKey(id: string, data: Record<string, unknown>): ApiKey {
  return {
    id,
    orgId: data.orgId as string,
    name: data.name as string,
    keyPrefix: data.keyPrefix as string,
    keyHash: data.keyHash as string,
    scopes: (data.scopes as ApiKeyScope[]) ?? [],
    rateLimit: (data.rateLimit as number) ?? 100,
    isActive: data.isActive as boolean,
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy as string,
    lastUsedAt: data.lastUsedAt ? toDate(data.lastUsedAt) : undefined,
    expiresAt: data.expiresAt ? toDate(data.expiresAt) : undefined,
  };
}

/**
 * Generate a cryptographically random API key.
 * Format: mk_live_{48 hex chars}
 * Uses crypto.getRandomValues if available (React Native Hermes / modern browsers).
 */
function generateRawKey(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without Web Crypto
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `mk_live_${hex}`;
}

/**
 * Hash an API key using SHA-256 via Web Crypto API.
 * Falls back to a simple deterministic hash for environments without SubtleCrypto.
 */
async function hashKey(key: string): Promise<string> {
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    crypto.subtle.digest
  ) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback: simple non-cryptographic hash (only for dev/test)
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const chr = key.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * API Key management for organization integration access.
 * Keys are stored as SHA-256 hashes — the plaintext is returned once at creation.
 */
class ApiKeyService {
  private apiKeysCol(orgId: string) {
    return collection(db, "organizations", orgId, "apiKeys");
  }

  /**
   * Create a new API key for an org.
   * Returns the full plaintext key — only time it's accessible.
   * Subsequent calls return only the prefix and metadata.
   */
  async createApiKey(params: {
    orgId: string;
    name: string;
    scopes: ApiKeyScope[];
    createdBy: string;
    rateLimit?: number;
    expiresAt?: Date;
  }): Promise<{ key: ApiKey; plaintext: string }> {
    const plaintext = generateRawKey();
    const keyHash = await hashKey(plaintext);
    const keyPrefix = plaintext.slice(0, 16); // "mk_live_XXXXXXXX"

    const payload: Record<string, unknown> = {
      orgId: params.orgId,
      name: params.name,
      keyPrefix,
      keyHash,
      scopes: params.scopes,
      rateLimit: params.rateLimit ?? 100,
      isActive: true,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      lastUsedAt: null,
      expiresAt: params.expiresAt ?? null,
    };

    const ref = await addDoc(this.apiKeysCol(params.orgId), payload);

    const key: ApiKey = {
      id: ref.id,
      orgId: params.orgId,
      name: params.name,
      keyPrefix,
      keyHash,
      scopes: params.scopes,
      rateLimit: params.rateLimit ?? 100,
      isActive: true,
      createdAt: new Date(),
      createdBy: params.createdBy,
      expiresAt: params.expiresAt,
    };

    return { key, plaintext };
  }

  /**
   * List all API keys for an org (metadata only — no plaintext).
   */
  async listApiKeys(orgId: string): Promise<ApiKey[]> {
    const snap = await getDocs(this.apiKeysCol(orgId));
    return snap.docs.map((d) => mapApiKey(d.id, d.data()));
  }

  /**
   * List only active API keys.
   */
  async listActiveApiKeys(orgId: string): Promise<ApiKey[]> {
    const snap = await getDocs(
      query(this.apiKeysCol(orgId), where("isActive", "==", true))
    );
    return snap.docs.map((d) => mapApiKey(d.id, d.data()));
  }

  /**
   * Revoke an API key (sets isActive = false, key can no longer authenticate).
   */
  async revokeApiKey(orgId: string, keyId: string): Promise<void> {
    await updateDoc(doc(this.apiKeysCol(orgId), keyId), {
      isActive: false,
    });
  }

  /**
   * Rotate an API key: revoke the old one and create a new one with the same settings.
   * Returns the new plaintext key.
   */
  async rotateApiKey(
    orgId: string,
    keyId: string,
    rotatedBy: string
  ): Promise<{ key: ApiKey; plaintext: string }> {
    // Get the existing key
    const existing = await getDocs(
      query(
        this.apiKeysCol(orgId),
        where("isActive", "==", true)
      )
    );
    const existingDoc = existing.docs.find((d) => d.id === keyId);
    if (!existingDoc) {
      throw new Error("API key not found or already revoked");
    }
    const existingKey = mapApiKey(existingDoc.id, existingDoc.data());

    // Revoke old key
    await this.revokeApiKey(orgId, keyId);

    // Create new key with same settings
    return this.createApiKey({
      orgId,
      name: `${existingKey.name} (rotated)`,
      scopes: existingKey.scopes,
      createdBy: rotatedBy,
      rateLimit: existingKey.rateLimit,
      expiresAt: existingKey.expiresAt,
    });
  }

  /**
   * Update an API key's name or scopes.
   */
  async updateApiKey(
    orgId: string,
    keyId: string,
    updates: { name?: string; scopes?: ApiKeyScope[]; rateLimit?: number }
  ): Promise<void> {
    await updateDoc(
      doc(this.apiKeysCol(orgId), keyId),
      updates as Record<string, unknown>
    );
  }
}

export const apiKeyService = new ApiKeyService();
