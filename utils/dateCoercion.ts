type TimestampLike = {
  toDate: () => Date;
};

const isTimestampLike = (value: unknown): value is TimestampLike => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const withToDate = value as { toDate?: unknown };
  return typeof withToDate.toDate === "function";
};

const isFirestoreSerializedTimestamp = (
  value: unknown
): value is { seconds: number; nanoseconds: number } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const asRecord = value as { seconds?: unknown; nanoseconds?: unknown };
  return (
    typeof asRecord.seconds === "number" &&
    typeof asRecord.nanoseconds === "number"
  );
};

export const coerceToDate = (value: unknown): Date | null => {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (isTimestampLike(value)) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (isFirestoreSerializedTimestamp(value)) {
    const parsed = new Date(value.seconds * 1000 + value.nanoseconds / 1e6);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};
