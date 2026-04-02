/**
 * Provider connections — persists OAuth/SDK connection state for
 * third-party health data providers (Fitbit, Garmin, Oura, Dexcom,
 * Withings, Samsung Health, Freestyle Libre).
 *
 * Replaces Firestore provider_connections collection with REST calls.
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";
import type { ProviderConnection, ProviderType } from "./healthTypes";

/**
 * Persist a provider connection (called after successful OAuth or SDK auth).
 * Creates or updates the connection record for this user + provider pair.
 */
export async function saveProviderConnection(
  userId: string,
  connection: Omit<ProviderConnection, "isConnected"> & { isConnected: boolean }
): Promise<void> {
  try {
    await api.post("/api/integrations/provider-connections", {
      userId,
      ...connection,
    });
  } catch (error) {
    logger.error(
      "Failed to save provider connection",
      { userId, provider: connection.provider, error },
      "providerConnections"
    );
    throw error;
  }
}

/**
 * Load all provider connections for a user.
 */
export async function getProviderConnections(
  userId: string
): Promise<ProviderConnection[]> {
  try {
    const res = await api.get<{ connections: ProviderConnection[] }>(
      `/api/integrations/provider-connections?userId=${userId}`
    );
    return res.connections ?? [];
  } catch (error) {
    logger.error(
      "Failed to load provider connections",
      { userId, error },
      "providerConnections"
    );
    return [];
  }
}

/**
 * Get a single provider connection for a user.
 */
export async function getProviderConnection(
  userId: string,
  provider: ProviderType
): Promise<ProviderConnection | null> {
  try {
    const res = await api.get<{ connection: ProviderConnection | null }>(
      `/api/integrations/provider-connections/${provider}?userId=${userId}`
    );
    return res.connection ?? null;
  } catch {
    return null;
  }
}

/**
 * Disconnect a provider (revoke tokens, remove connection record).
 */
export async function disconnectProvider(
  userId: string,
  provider: ProviderType
): Promise<void> {
  try {
    await api.delete(`/api/integrations/provider-connections/${provider}?userId=${userId}`);
  } catch (error) {
    logger.error(
      "Failed to disconnect provider",
      { userId, provider, error },
      "providerConnections"
    );
    throw error;
  }
}
