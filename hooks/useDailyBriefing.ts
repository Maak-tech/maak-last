/**
 * useDailyBriefing hook
 * Reads today's AI-generated daily briefing from Firestore.
 */

import { doc, getDoc, Timestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";

export type DailyBriefing = {
  summary: string;
  score?: number;
  highlights: string[];
  highlightsAr?: string[];
  generatedAt: Date;
};

type UseDailyBriefingReturn = {
  briefing: DailyBriefing | null;
  loading: boolean;
  hasBriefing: boolean;
  isToday: boolean;
};

function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useDailyBriefing(
  userId: string | undefined
): UseDailyBriefingReturn {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!userId || fetchedRef.current) return;
    fetchedRef.current = true;

    setLoading(true);

    const todayKey = getTodayKey();
    const briefingRef = doc(db, "users", userId, "briefings", todayKey);

    getDoc(briefingRef)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBriefing({
            summary: data.summary as string,
            score: data.score as number | undefined,
            highlights: (data.highlights as string[]) ?? [],
            highlightsAr: (data.highlightsAr as string[]) ?? [],
            generatedAt:
              data.generatedAt instanceof Timestamp
                ? data.generatedAt.toDate()
                : new Date(),
          });
        }
      })
      .catch(() => {
        // Silently fail — briefing is a nice-to-have enhancement
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const isToday =
    briefing !== null &&
    briefing.generatedAt.toDateString() === new Date().toDateString();

  return {
    briefing,
    loading,
    hasBriefing: briefing !== null,
    isToday,
  };
}
