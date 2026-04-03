/**
 * React Native global type augmentations.
 *
 * Extends the global namespace with React Native-specific globals that
 * TypeScript doesn't know about by default (e.g. __DEV__, HermesInternal).
 */

declare global {
  /** True when running in Expo Go or development builds; false in production. */
  const __DEV__: boolean;

  /** Set by the Hermes JS engine when the app runs on Hermes. */
  const HermesInternal:
    | {
        getRuntimeProperties?: () => Record<string, string>;
      }
    | undefined;

  /** Expo Router typed route helper — augmented by expo-router. */
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_URL?: string;
      EXPO_PUBLIC_SENTRY_DSN?: string;
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?: string;
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?: string;
      EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?: string;
      NODE_ENV: "development" | "production" | "test";
    }
  }
}

export {};
