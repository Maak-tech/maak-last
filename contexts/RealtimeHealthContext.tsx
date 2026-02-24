import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";
import { db } from "@/lib/firebase";
import type {
  FamilyMemberUpdate,
  TrendAlert,
} from "@/lib/services/realtimeHealthService";
import type { EmergencyAlert } from "@/types";
import type { VitalAnomaly } from "@/types/discoveries";

type RealtimeEvent<T> = {
  id: number;
  payload: T;
  receivedAt: Date;
};

type AlertResolvedPayload = {
  alertId: string;
  resolverId: string;
};

type VitalAddedPayload = {
  userId: string;
  type: string;
  value: number;
  timestamp: Date;
};

type RealtimeHealthContextType = {
  trendAlertEvent: RealtimeEvent<TrendAlert> | null;
  familyUpdateEvent: RealtimeEvent<FamilyMemberUpdate> | null;
  alertCreatedEvent: RealtimeEvent<EmergencyAlert> | null;
  alertResolvedEvent: RealtimeEvent<AlertResolvedPayload> | null;
  vitalAddedEvent: RealtimeEvent<VitalAddedPayload> | null;
  anomalyDetectedEvent: RealtimeEvent<VitalAnomaly> | null;
  errorEvent: RealtimeEvent<Error> | null;
  familyMemberIds: string[];
  setFamilyMemberIds: (ids: string[]) => void;
};

const RealtimeHealthContext = createContext<
  RealtimeHealthContextType | undefined
>(undefined);

const normalizeIds = (ids: string[]) =>
  Array.from(new Set(ids.filter(Boolean))).sort();

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

export const useRealtimeHealthContext = () => {
  const context = useContext(RealtimeHealthContext);
  if (!context) {
    throw new Error(
      "useRealtimeHealthContext must be used within a RealtimeHealthProvider"
    );
  }
  return context;
};

export const RealtimeHealthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [familyMemberIds, setFamilyMemberIdsState] = useState<string[]>([]);
  const eventCounterRef = useRef(0);

  const nextEventId = useCallback(() => {
    eventCounterRef.current += 1;
    return eventCounterRef.current;
  }, []);

  const [trendAlertEvent, setTrendAlertEvent] =
    useState<RealtimeEvent<TrendAlert> | null>(null);
  const [familyUpdateEvent, setFamilyUpdateEvent] =
    useState<RealtimeEvent<FamilyMemberUpdate> | null>(null);
  const [alertCreatedEvent, setAlertCreatedEvent] =
    useState<RealtimeEvent<EmergencyAlert> | null>(null);
  const [alertResolvedEvent, setAlertResolvedEvent] =
    useState<RealtimeEvent<AlertResolvedPayload> | null>(null);
  const [vitalAddedEvent, setVitalAddedEvent] =
    useState<RealtimeEvent<VitalAddedPayload> | null>(null);
  const [anomalyDetectedEvent, setAnomalyDetectedEvent] =
    useState<RealtimeEvent<VitalAnomaly> | null>(null);
  const [errorEvent, setErrorEvent] = useState<RealtimeEvent<Error> | null>(
    null
  );

  const setFamilyMemberIds = useCallback((ids: string[]) => {
    const normalized = normalizeIds(ids);
    setFamilyMemberIdsState((prev) =>
      arraysEqual(prev, normalized) ? prev : normalized
    );
  }, []);

  const handleTrendAlert = useCallback(
    (alert: TrendAlert) => {
      setTrendAlertEvent({
        id: nextEventId(),
        payload: alert,
        receivedAt: new Date(),
      });
    },
    [nextEventId]
  );

  const handleFamilyUpdate = useCallback(
    (update: FamilyMemberUpdate) => {
      setFamilyUpdateEvent({
        id: nextEventId(),
        payload: update,
        receivedAt: new Date(),
      });
    },
    [nextEventId]
  );

  const handleAlertCreated = useCallback(
    (alert: EmergencyAlert) => {
      setAlertCreatedEvent({
        id: nextEventId(),
        payload: alert,
        receivedAt: new Date(),
      });
    },
    [nextEventId]
  );

  const handleAlertResolved = useCallback(
    (alertId: string, resolverId: string) => {
      setAlertResolvedEvent({
        id: nextEventId(),
        payload: { alertId, resolverId },
        receivedAt: new Date(),
      });
    },
    [nextEventId]
  );

  const handleVitalAdded = useCallback(
    (vital: VitalAddedPayload) => {
      setVitalAddedEvent({
        id: nextEventId(),
        payload: vital,
        receivedAt: new Date(),
      });
    },
    [nextEventId]
  );

  const handleError = useCallback(
    (error: Error) => {
      setErrorEvent({
        id: nextEventId(),
        payload: error,
        receivedAt: new Date(),
      });
    },
    [nextEventId]
  );

  // Listen for new anomaly detections in Firestore
  useEffect(() => {
    if (!user?.id) return;

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    let isInitialLoad = true;

    const q = query(
      collection(db, "users", user.id, "anomalies"),
      where("acknowledged", "==", false),
      where("timestamp", ">=", Timestamp.fromDate(twentyFourHoursAgo)),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (isInitialLoad) {
          isInitialLoad = false;
          return;
        }
        const added = snapshot
          .docChanges()
          .filter((change) => change.type === "added");
        if (added.length > 0) {
          const latestChange = added[0];
          const data = latestChange.doc.data();
          setAnomalyDetectedEvent({
            id: nextEventId(),
            payload: {
              ...data,
              id: latestChange.doc.id,
              timestamp: data.timestamp?.toDate?.() ?? new Date(),
            } as VitalAnomaly,
            receivedAt: new Date(),
          });
        }
      },
      (error) => {
        // Handle quota errors gracefully
        if (error && typeof error === "object" && "code" in error) {
          if (error.code === "resource-exhausted") {
            // Quota exceeded - log but don't crash
            console.warn("Firestore quota exceeded for anomalies listener");
            // The listener will automatically retry with backoff
          } else {
            // Other errors - log for debugging
            console.error("Anomalies listener error:", error);
          }
        }
      }
    );

    return () => unsubscribe();
  }, [user?.id, nextEventId]);

  useRealtimeHealth({
    userId: user?.id,
    familyId: user?.familyId,
    familyMemberIds,
    onTrendAlert: handleTrendAlert,
    onFamilyMemberUpdate: handleFamilyUpdate,
    onAlertCreated: handleAlertCreated,
    onAlertResolved: handleAlertResolved,
    onVitalAdded: handleVitalAdded,
    onError: handleError,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!trendAlertEvent) {
      return;
    }
    const alert = trendAlertEvent.payload;
    if (alert.severity !== "critical") {
      return;
    }
    Alert.alert(
      isRTL ? "تنبيه صحي حرج" : "Critical Health Alert",
      alert.trendAnalysis.message,
      [{ text: isRTL ? "موافق" : "OK" }]
    );
  }, [trendAlertEvent, isRTL]);

  const value = useMemo(
    () => ({
      trendAlertEvent,
      familyUpdateEvent,
      alertCreatedEvent,
      alertResolvedEvent,
      vitalAddedEvent,
      anomalyDetectedEvent,
      errorEvent,
      familyMemberIds,
      setFamilyMemberIds,
    }),
    [
      trendAlertEvent,
      familyUpdateEvent,
      alertCreatedEvent,
      alertResolvedEvent,
      vitalAddedEvent,
      anomalyDetectedEvent,
      errorEvent,
      familyMemberIds,
      setFamilyMemberIds,
    ]
  );

  return (
    <RealtimeHealthContext.Provider value={value}>
      {children}
    </RealtimeHealthContext.Provider>
  );
};
