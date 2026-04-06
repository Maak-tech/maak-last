import * as SecureStore from 'expo-secure-store';
import { api, ApiError } from '@/lib/apiClient';

const CACHE_KEY = 'emergency_cache';

export interface EmergencyCache {
  userId: string;
  name: string;
  bloodType: string | null;
  dateOfBirth: string | null; // ISO string
  allergies: Array<{ substance: string; severity: string; notes?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; isActive: boolean }>;
  emergencyContacts: Array<{ name: string; phone: string; relation: string; isPrimary: boolean }>;
  cachedAt: string; // ISO string
}

/**
 * Fetch the latest emergency data from the API and persist it in SecureStore.
 * Safe to call fire-and-forget — all errors are caught and logged.
 */
export async function syncEmergencyCache(
  user: { id: string; name?: string; fullName?: string; bloodType?: string | null; dateOfBirth?: string | null; emergencyContacts?: EmergencyCache['emergencyContacts'] },
): Promise<void> {
  try {
    const userId = user.id;

    // Parallel fetch of allergies, medications, and full user profile
    const [allergiesRes, medicationsRes, profileRes] = await Promise.allSettled([
      api.get<{ allergies?: EmergencyCache['allergies']; data?: EmergencyCache['allergies'] }>(
        `/api/health/allergies?userId=${userId}`
      ),
      api.get<{ medications?: EmergencyCache['medications']; data?: EmergencyCache['medications'] }>(
        `/api/health/medications?userId=${userId}`
      ),
      api.get<{
        name?: string;
        fullName?: string;
        bloodType?: string | null;
        dateOfBirth?: string | null;
        emergencyContacts?: EmergencyCache['emergencyContacts'];
      }>('/api/user/me'),
    ]);

    // If any request was rejected with a 401 or 403, the session has expired.
    // Do NOT overwrite the cache — preserve the last valid data so the emergency
    // screen continues to show useful information to first responders.
    for (const result of [allergiesRes, medicationsRes, profileRes]) {
      if (result.status === 'rejected') {
        const err = result.reason;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          console.warn('[emergencyCache] Auth expired during sync — keeping existing cache');
          return;
        }
      }
    }

    // Extract allergies
    let allergies: EmergencyCache['allergies'] = [];
    if (allergiesRes.status === 'fulfilled' && allergiesRes.value) {
      const raw = allergiesRes.value;
      allergies = raw.allergies ?? raw.data ?? [];
    }

    // Extract medications (active only)
    let medications: EmergencyCache['medications'] = [];
    if (medicationsRes.status === 'fulfilled' && medicationsRes.value) {
      const raw = medicationsRes.value;
      const all = raw.medications ?? raw.data ?? [];
      medications = all.filter((m) => m.isActive !== false);
    }

    // Extract profile info — fall back to what the caller already has
    let name = user.name ?? user.fullName ?? '';
    let bloodType: string | null = user.bloodType ?? null;
    let dateOfBirth: string | null = user.dateOfBirth ?? null;
    let emergencyContacts: EmergencyCache['emergencyContacts'] = user.emergencyContacts ?? [];

    if (profileRes.status === 'fulfilled' && profileRes.value) {
      const profile = profileRes.value;
      name = profile.name ?? profile.fullName ?? name;
      bloodType = profile.bloodType ?? bloodType;
      dateOfBirth = profile.dateOfBirth ?? dateOfBirth;
      emergencyContacts = profile.emergencyContacts ?? emergencyContacts;
    }

    // Determine the cachedAt timestamp.  If the existing cache already has data,
    // preserve its cachedAt on a partial failure (some requests rejected but not
    // auth-related) so the stale-data banner shows the correct last-valid time.
    // Only set a fresh timestamp when all three requests succeeded.
    const allSucceeded =
      allergiesRes.status === 'fulfilled' &&
      medicationsRes.status === 'fulfilled' &&
      profileRes.status === 'fulfilled';

    let cachedAt = new Date().toISOString();
    if (!allSucceeded) {
      const existing = await getEmergencyCache();
      if (existing) {
        // Partial failure — keep the last-valid timestamp so the stale banner is accurate
        console.warn('[emergencyCache] Partial sync failure — preserving existing cachedAt');
        cachedAt = existing.cachedAt;
      }
    }

    const cache: EmergencyCache = {
      userId,
      name,
      bloodType,
      dateOfBirth,
      allergies,
      medications,
      emergencyContacts,
      cachedAt,
    };

    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    // On any unexpected error, preserve the existing cache entirely so the
    // emergency screen always shows the last valid data, not empty/broken data.
    console.warn(
      '[emergencyCacheService] syncEmergencyCache failed:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Read the locally-cached emergency data. Returns null if nothing is cached
 * or the stored value cannot be parsed.
 */
export async function getEmergencyCache(): Promise<EmergencyCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EmergencyCache;
  } catch {
    return null;
  }
}

/**
 * Remove the cached emergency data from SecureStore.
 */
export async function clearEmergencyCache(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY);
  } catch (err) {
    console.warn(
      '[emergencyCacheService] clearEmergencyCache failed:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

export const emergencyCacheService = {
  syncEmergencyCache,
  getEmergencyCache,
  clearEmergencyCache,
};
