import React, { createContext, useCallback, useContext, useState } from "react";

export interface MedicationAlarm {
  id: string;
  medicationName: string;
  dosage?: string;
  scheduledAt: Date;
}

interface MedicationAlarmContextValue {
  activeAlarm: MedicationAlarm | null;
  triggerAlarm: (alarm: MedicationAlarm) => void;
  dismissAlarm: () => void;
}

const MedicationAlarmContext = createContext<MedicationAlarmContextValue>({
  activeAlarm: null,
  triggerAlarm: () => {},
  dismissAlarm: () => {},
});

export function MedicationAlarmProvider({ children }: { children: React.ReactNode }) {
  const [activeAlarm, setActiveAlarm] = useState<MedicationAlarm | null>(null);

  const triggerAlarm = useCallback((alarm: MedicationAlarm) => {
    setActiveAlarm(alarm);
  }, []);

  const dismissAlarm = useCallback(() => {
    setActiveAlarm(null);
  }, []);

  return (
    <MedicationAlarmContext.Provider value={{ activeAlarm, triggerAlarm, dismissAlarm }}>
      {children}
    </MedicationAlarmContext.Provider>
  );
}

export function useMedicationAlarm() {
  return useContext(MedicationAlarmContext);
}
