/**
 * Trend Service
 * Fetches and manages health trend data for display in the UI
 */

import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TrendAnalysis, SymptomTrendAnalysis } from "./trendDetectionService";
import {
  analyzeVitalTrend,
  analyzeSymptomTrend,
} from "./trendDetectionService";

export interface TrendAlert {
  id: string;
  userId: string;
  userName: string;
  trendType: "vital" | "symptom";
  analysisType: string;
  trend: string;
  severity: "critical" | "warning";
  message: string;
  timestamp: Date;
  changePercent?: number;
  frequency?: number;
}

export const trendService = {
  /**
   * Get recent trend alerts for a user (from notification logs)
   */
  async getTrendAlerts(
    userId: string,
    limitCount: number = 10
  ): Promise<TrendAlert[]> {
    try {
      const q = query(
        collection(db, "notificationLogs"),
        where("type", "==", "trend_alert"),
        where("userId", "==", userId),
        orderBy("sentAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const alerts: TrendAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || "User",
          trendType: data.trendType || "vital",
          analysisType: data.analysisType || "",
          trend: data.trend || "stable",
          severity: data.severity || "warning",
          message: data.message || "",
          timestamp: data.sentAt?.toDate() || new Date(),
          changePercent: data.changePercent,
          frequency: data.frequency,
        });
      });

      return alerts;
    } catch (error) {
      console.error("Error fetching trend alerts:", error);
      return [];
    }
  },

  /**
   * Get trend alerts for all family members (for admins)
   */
  async getFamilyTrendAlerts(
    familyMemberIds: string[],
    limitCount: number = 20
  ): Promise<TrendAlert[]> {
    try {
      if (familyMemberIds.length === 0) return [];

      const q = query(
        collection(db, "notificationLogs"),
        where("type", "==", "trend_alert"),
        where("userId", "in", familyMemberIds),
        orderBy("sentAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const alerts: TrendAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || "User",
          trendType: data.trendType || "vital",
          analysisType: data.analysisType || "",
          trend: data.trend || "stable",
          severity: data.severity || "warning",
          message: data.message || "",
          timestamp: data.sentAt?.toDate() || new Date(),
          changePercent: data.changePercent,
          frequency: data.frequency,
        });
      });

      return alerts;
    } catch (error) {
      console.error("Error fetching family trend alerts:", error);
      return [];
    }
  },

  /**
   * Get vital signs data for trend analysis
   */
  async getVitalDataForTrend(
    userId: string,
    vitalType: string,
    days: number = 7
  ): Promise<Array<{ value: number; timestamp: Date }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("type", "==", vitalType),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        orderBy("timestamp", "asc")
      );

      const querySnapshot = await getDocs(q);
      const data: Array<{ value: number; timestamp: Date }> = [];

      querySnapshot.forEach((doc) => {
        const vitalData = doc.data();
        const value = vitalData.value;
        const timestamp = vitalData.timestamp?.toDate() || new Date();

        if (typeof value === "number") {
          data.push({ value, timestamp });
        }
      });

      return data;
    } catch (error) {
      console.error("Error fetching vital data for trend:", error);
      return [];
    }
  },

  /**
   * Get symptom data for trend analysis
   */
  async getSymptomDataForTrend(
    userId: string,
    symptomType: string,
    days: number = 30
  ): Promise<Array<{ severity: number; timestamp: Date }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, "symptoms"),
        where("userId", "==", userId),
        where("type", "==", symptomType),
        where("timestamp", ">=", Timestamp.fromDate(startDate)),
        orderBy("timestamp", "asc")
      );

      const querySnapshot = await getDocs(q);
      const data: Array<{ severity: number; timestamp: Date }> = [];

      querySnapshot.forEach((doc) => {
        const symptomData = doc.data();
        const severity = symptomData.severity;
        const timestamp = symptomData.timestamp?.toDate() || new Date();

        if (typeof severity === "number") {
          data.push({ severity, timestamp });
        }
      });

      return data;
    } catch (error) {
      console.error("Error fetching symptom data for trend:", error);
      return [];
    }
  },

  /**
   * Analyze vital trend for a specific vital type
   */
  async analyzeVitalTrendForUser(
    userId: string,
    vitalType: string,
    unit: string,
    days: number = 7
  ): Promise<TrendAnalysis | null> {
    try {
      const data = await this.getVitalDataForTrend(userId, vitalType, days);
      if (data.length < 3) return null;

      return analyzeVitalTrend(data, vitalType, unit, days);
    } catch (error) {
      console.error("Error analyzing vital trend:", error);
      return null;
    }
  },

  /**
   * Analyze symptom trend for a specific symptom type
   */
  async analyzeSymptomTrendForUser(
    userId: string,
    symptomType: string,
    days: number = 30
  ): Promise<SymptomTrendAnalysis | null> {
    try {
      const data = await this.getSymptomDataForTrend(userId, symptomType, days);
      if (data.length < 2) return null;

      return analyzeSymptomTrend(data, symptomType, days);
    } catch (error) {
      console.error("Error analyzing symptom trend:", error);
      return null;
    }
  },
};

