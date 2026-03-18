import { api } from "@/lib/apiClient";
import type { ApiKey, ApiKeyScope } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function mapApiKey(data: Record<string, unknown>): ApiKey {
  return {
    id: data.id as string,
    orgId: data.orgId as string,
    name: (data.name as string) ?? "",
    keyPrefix: data.keyPrefix as string,
    keyHash: (data.keyHash as string) ?? "",
    scopes: (data.scopes as ApiKeyScope[]) ?? [],
    rateLimit: (data.rateLimit as number) ?? 100,
    isActive: data.isActive as boolean,
    createdAt: toDate(data.createdAt),
    createdBy: (data.createdBy as string) ?? "",
    lastUsedAt: data.lastUsedAt ? toDate(data.lastUsedAt) : undefined,
    expiresAt: data.expiresAt ? toDate(data.expiresAt) : undefined,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * API Key management for organization integration access.
 *
 * Keys are generated server-side (POST /api/org/:orgId/keys) — the plaintext is
 * returned once in the creation response and never stored server-side.
 * All subsequent reads return metadata only (keyPrefix, scopes, name, etc.).
 *
 * Session-authenticated via Better-auth cookie (same as all other /api/* routes).
 */
class ApiKeyService {
  /**
   * Create a new API key for an org.
   * The server generates the plaintext key and returns it once in this response.
   * Subsequent calls return only the prefix and metadata — save the plaintext now.
   */
  async createApiKey(params: {
    orgId: string;
    name: string;
    scopes: ApiKeyScope[];
    createdBy: string;
    rateLimit?: number;
    expiresAt?: Date;
  }): Promise<{ key: ApiKey; plaintext: string }> {
    const raw = await api.post<Record<string, unknown>>(
      `/api/org/${params.orgId}/keys`,
      {
        name: params.name,
        scopes: params.scopes,
      }
    );

    const plaintext = raw.plaintext as string;

    const key: ApiKey = mapApiKey({
      ...raw,
      orgId: params.orgId,
      createdBy: params.createdBy,
      rateLimit: params.rateLimit ?? 100,
      expiresAt: params.expiresAt?.toISOString(),
    });

    return { key, plaintext };
  }

  /**
   * List all API keys for an org (metadata only — no plaintext or hashes).
   */
  async listApiKeys(orgId: string): Promise<ApiKey[]> {
    const rows = await api.get<Record<string, unknown>[]>(`/api/org/${orgId}/keys`);
    return (rows ?? []).map(mapApiKey);
  }

  /**
   * List only active API keys.
   */
  async listActiveApiKeys(orgId: string): Promise<ApiKey[]> {
    const all = await this.listApiKeys(orgId);
    return all.filter((k) => k.isActive);
  }

  /**
   * Revoke an API key (soft delete — sets isActive = false on the server).
   */
  async revokeApiKey(orgId: string, keyId: string): Promise<void> {
    await api.delete(`/api/org/${orgId}/keys/${keyId}`);
  }

  /**
   * Rotate an API key: revoke the old one and create a new one with the same settings.
   * Returns the new plaintext key — shown once only.
   */
  async rotateApiKey(
    orgId: string,
    keyId: string,
    rotatedBy: string
  ): Promise<{ key: ApiKey; plaintext: string }> {
    const raw = await api.post<Record<string, unknown>>(
      `/api/org/${orgId}/keys/${keyId}/rotate`,
      {}
    );

    const plaintext = raw.plaintext as string;
    const key: ApiKey = mapApiKey({
      ...raw,
      orgId,
      createdBy: rotatedBy,
    });

    return { key, plaintext };
  }

  /**
   * Update an API key's name or scopes.
   */
  async updateApiKey(
    orgId: string,
    keyId: string,
    updates: { name?: string; scopes?: ApiKeyScope[]; rateLimit?: number }
  ): Promise<void> {
    await api.patch(`/api/org/${orgId}/keys/${keyId}`, {
      name: updates.name,
      scopes: updates.scopes,
    });
  }
}

export const apiKeyService = new ApiKeyService();
