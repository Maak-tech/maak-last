import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HealthProvider } from "./healthMetricsCatalog";
import type { ProviderConnection } from "./healthTypes";
import { HEALTH_STORAGE_KEYS } from "./healthTypes";

export const getProviderStorageKey = (provider: HealthProvider): string => {
  switch (provider) {
    case "apple_health":
      return HEALTH_STORAGE_KEYS.APPLE_HEALTH_CONNECTION;
    case "health_connect":
      return HEALTH_STORAGE_KEYS.HEALTH_CONNECT_CONNECTION;
    case "fitbit":
      return HEALTH_STORAGE_KEYS.FITBIT_CONNECTION;
    case "samsung_health":
      return HEALTH_STORAGE_KEYS.SAMSUNG_HEALTH_TOKENS;
    case "garmin":
      return HEALTH_STORAGE_KEYS.GARMIN_TOKENS;
    case "withings":
      return HEALTH_STORAGE_KEYS.WITHINGS_TOKENS;
    case "oura":
      return HEALTH_STORAGE_KEYS.OURA_TOKENS;
    case "dexcom":
      return HEALTH_STORAGE_KEYS.DEXCOM_TOKENS;
    case "freestyle_libre":
      return HEALTH_STORAGE_KEYS.FREESTYLE_LIBRE_TOKENS;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

export const getProviderConnection = async (
  provider: HealthProvider
): Promise<ProviderConnection | null> => {
  try {
    const data = await AsyncStorage.getItem(getProviderStorageKey(provider));
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveProviderConnection = async (
  connection: ProviderConnection
): Promise<void> => {
  await AsyncStorage.setItem(
    getProviderStorageKey(connection.provider),
    JSON.stringify(connection)
  );
};
