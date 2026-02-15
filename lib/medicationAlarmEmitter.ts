/**
 * Emits medication alarm events from notification listeners to the alarm modal.
 * Used to bridge notification handlers (which run outside React) with the alarm UI.
 */

export type MedicationAlarmPayload = {
  medicationId?: string;
  medicationName: string;
  dosage?: string;
  reminderId?: string;
  reminderTime?: string;
};

type Listener = (alarm: MedicationAlarmPayload) => void;

const listeners: Set<Listener> = new Set();

export function subscribeToMedicationAlarm(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitMedicationAlarm(alarm: MedicationAlarmPayload): void {
  listeners.forEach((l) => {
    try {
      l(alarm);
    } catch (_e) {
      // Ignore listener errors
    }
  });
}
