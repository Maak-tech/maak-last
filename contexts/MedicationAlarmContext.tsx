"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type MedicationAlarm = {
  medicationId?: string;
  medicationName: string;
  dosage?: string;
  reminderId?: string;
  reminderTime?: string;
};

type MedicationAlarmContextValue = {
  activeAlarm: MedicationAlarm | null;
  showAlarm: (alarm: MedicationAlarm) => void;
  dismissAlarm: () => void;
};

const MedicationAlarmContext =
  createContext<MedicationAlarmContextValue | null>(null);

export function MedicationAlarmProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeAlarm, setActiveAlarm] = useState<MedicationAlarm | null>(null);

  const showAlarm = useCallback((alarm: MedicationAlarm) => {
    setActiveAlarm(alarm);
  }, []);

  const dismissAlarm = useCallback(() => {
    setActiveAlarm(null);
  }, []);

  const value = useMemo(
    () => ({ activeAlarm, showAlarm, dismissAlarm }),
    [activeAlarm, showAlarm, dismissAlarm]
  );

  return (
    <MedicationAlarmContext.Provider value={value}>
      {children}
    </MedicationAlarmContext.Provider>
  );
}

export function useMedicationAlarm() {
  const ctx = useContext(MedicationAlarmContext);
  if (!ctx) {
    return {
      activeAlarm: null,
      showAlarm: () => undefined,
      dismissAlarm: () => undefined,
    };
  }
  return ctx;
}
