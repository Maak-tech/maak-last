import type { PurchasesOffering } from "react-native-purchases";

/**
 * Utility functions for accessing RevenueCat offering metadata
 * Provides type-safe access with fallback values
 */

/**
 * Get a localized string value from metadata
 * Supports both direct string values and localized objects
 */
export function getLocalizedMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
  language = "en",
  fallback = ""
): string {
  if (!metadata?.[key]) {
    return fallback;
  }

  const value = metadata[key];

  // If it's a localized object (e.g., { en: "...", ar: "..." })
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const localizedValue = value as Record<string, unknown>;
    // Try the requested language first
    if (typeof localizedValue[language] === "string") {
      return localizedValue[language];
    }
    // Fall back to English
    if (typeof localizedValue.en === "string") {
      return localizedValue.en;
    }
    // Fall back to first available string value
    const firstStringValue = Object.values(localizedValue).find(
      (v) => typeof v === "string"
    );
    if (typeof firstStringValue === "string") {
      return firstStringValue;
    }
    return fallback;
  }

  // If it's a direct string value
  if (typeof value === "string") {
    return value;
  }

  return fallback;
}

/**
 * Get a string value from metadata (non-localized)
 */
export function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback = ""
): string {
  if (!metadata?.[key]) {
    return fallback;
  }

  const value = metadata[key];
  return typeof value === "string" ? value : fallback;
}

/**
 * Get a boolean value from metadata
 */
export function getMetadataBoolean(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback = false
): boolean {
  if (!metadata || metadata[key] === undefined || metadata[key] === null) {
    return fallback;
  }

  const value = metadata[key];
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Get a number value from metadata
 */
export function getMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback = 0
): number {
  if (!metadata || metadata[key] === undefined || metadata[key] === null) {
    return fallback;
  }

  const value = metadata[key];
  return typeof value === "number" ? value : fallback;
}

/**
 * Get an array value from metadata
 */
export function getMetadataArray<T>(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: T[] = []
): T[] {
  if (!metadata?.[key]) {
    return fallback;
  }

  const value = metadata[key];
  return Array.isArray(value) ? value : fallback;
}

/**
 * Get an object value from metadata
 */
export function getMetadataObject<T>(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: T | null = null
): T | null {
  if (!metadata?.[key]) {
    return fallback;
  }

  const value = metadata[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as T)
    : fallback;
}

/**
 * Extract all metadata from an offering with type-safe helpers
 */
export class OfferingMetadata {
  private readonly metadata: Record<string, unknown>;
  private readonly language: string;

  constructor(offering: PurchasesOffering | null | undefined, language = "en") {
    this.metadata = offering?.metadata || {};
    this.language = language;
  }

  /**
   * Get a localized string value
   */
  getString(key: string, fallback = ""): string {
    return getLocalizedMetadataString(
      this.metadata,
      key,
      this.language,
      fallback
    );
  }

  /**
   * Get a non-localized string value
   */
  getStringRaw(key: string, fallback = ""): string {
    return getMetadataString(this.metadata, key, fallback);
  }

  /**
   * Get a boolean value
   */
  getBoolean(key: string, fallback = false): boolean {
    return getMetadataBoolean(this.metadata, key, fallback);
  }

  /**
   * Get a number value
   */
  getNumber(key: string, fallback = 0): number {
    return getMetadataNumber(this.metadata, key, fallback);
  }

  /**
   * Get an array value
   */
  getArray<T>(key: string, fallback: T[] = []): T[] {
    return getMetadataArray<T>(this.metadata, key, fallback);
  }

  /**
   * Get an object value
   */
  getObject<T>(key: string, fallback: T | null = null): T | null {
    return getMetadataObject<T>(this.metadata, key, fallback);
  }

  /**
   * Get the raw metadata object
   */
  getRaw(): Record<string, unknown> {
    return this.metadata;
  }
}

/**
 * Convenience function to create an OfferingMetadata instance
 */
export function createOfferingMetadata(
  offering: PurchasesOffering | null | undefined,
  language = "en"
): OfferingMetadata {
  return new OfferingMetadata(offering, language);
}

/**
 * Example usage:
 *
 * ```typescript
 * import { useRevenueCat } from "@/hooks/useRevenueCat";
 * import { createOfferingMetadata } from "@/lib/utils/offeringMetadata";
 * import { useTranslation } from "react-i18next";
 *
 * function MyComponent() {
 *   const { offerings } = useRevenueCat();
 *   const { i18n } = useTranslation();
 *   const language = i18n.language.split('-')[0] || 'en';
 *
 *   const metadata = createOfferingMetadata(offerings?.current, language);
 *
 *   const title = metadata.getString('paywall_title', 'Upgrade to Premium');
 *   const buttonColor = metadata.getStringRaw('button_color', '#2563EB');
 *   const showBenefits = metadata.getBoolean('show_family_benefits', false);
 *   const benefits = metadata.getArray('benefits', []);
 *
 *   return (
 *     <View>
 *       <Text>{title}</Text>
 *       <Button backgroundColor={buttonColor} />
 *       {showBenefits && <BenefitsList benefits={benefits} />}
 *     </View>
 *   );
 * }
 * ```
 */
