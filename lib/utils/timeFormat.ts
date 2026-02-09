const TIME_12_OR_24_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/;
const TIME_24_REGEX = /^(\d{1,2}):(\d{2})$/;
const STRICT_TIME_12_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/;

/**
 * Utility functions for converting between 24-hour and 12-hour time formats
 */

/**
 * Convert 24-hour time (HH:MM) to 12-hour format (h:mm AM/PM)
 * @param time24 - Time in 24-hour format (e.g., "14:30")
 * @returns Time in 12-hour format (e.g., "2:30 PM")
 */
export function convertTo12Hour(time24: string): string {
  if (!time24?.includes(":")) {
    return time24;
  }

  const [hoursStr, minutesStr] = time24.split(":");
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time24;
  }

  const period = hours >= 12 ? "PM" : "AM";
  let hours12 = hours;
  if (hours === 0) {
    hours12 = 12;
  } else if (hours > 12) {
    hours12 = hours - 12;
  }

  return `${hours12}:${minutesStr.padStart(2, "0")} ${period}`;
}

/**
 * Convert 12-hour time (h:mm AM/PM) to 24-hour format (HH:MM)
 * @param time12 - Time in 12-hour format (e.g., "2:30 PM" or "2:30PM")
 * @returns Time in 24-hour format (e.g., "14:30")
 */
export function convertTo24Hour(time12: string): string {
  if (!time12) {
    return "";
  }

  // Remove extra spaces and convert to uppercase for parsing
  const cleaned = time12.trim().toUpperCase();

  // Match patterns like "2:30 PM", "2:30PM", "14:30" (already 24-hour)
  const match = cleaned.match(TIME_12_OR_24_REGEX);

  if (!match) {
    // If it doesn't match 12-hour format, check if it's already 24-hour format
    const match24 = cleaned.match(TIME_24_REGEX);
    if (match24) {
      const hours = Number.parseInt(match24[1], 10);
      const minutes = match24[2];
      // Validate 24-hour format
      if (
        hours >= 0 &&
        hours <= 23 &&
        Number.parseInt(minutes, 10) >= 0 &&
        Number.parseInt(minutes, 10) <= 59
      ) {
        return `${hours.toString().padStart(2, "0")}:${minutes}`;
      }
    }
    return time12; // Return as-is if can't parse
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3] || "";

  if (
    hours < 1 ||
    hours > 12 ||
    Number.parseInt(minutes, 10) < 0 ||
    Number.parseInt(minutes, 10) > 59
  ) {
    return time12; // Invalid time
  }

  let hours24 = hours;

  if (period === "PM" && hours !== 12) {
    hours24 = hours + 12;
  } else if (period === "AM" && hours === 12) {
    hours24 = 0;
  }

  return `${hours24.toString().padStart(2, "0")}:${minutes}`;
}

/**
 * Validate time format (accepts both 12-hour and 24-hour)
 * @param time - Time string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimeFormat(time: string): boolean {
  if (!time.trim()) {
    return false;
  }

  const cleaned = time.trim().toUpperCase();

  // Check 12-hour format (h:mm AM/PM)
  const match12 = cleaned.match(STRICT_TIME_12_REGEX);
  if (match12) {
    const hours = Number.parseInt(match12[1], 10);
    const minutes = Number.parseInt(match12[2], 10);
    return hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59;
  }

  // Check 24-hour format (HH:MM)
  const match24 = cleaned.match(TIME_24_REGEX);
  if (match24) {
    const hours = Number.parseInt(match24[1], 10);
    const minutes = Number.parseInt(match24[2], 10);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  return false;
}
