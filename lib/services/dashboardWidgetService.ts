import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type WidgetId =
  | "healthScore"
  | "stats"
  | "recentSymptoms"
  | "todaysMedications"
  | "healthInsights"
  | "alerts"
  | "familyMembers"
  | "quickActions";

export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
  order: number;
  size?: "small" | "medium" | "large";
}

export interface DashboardConfig {
  userId: string;
  widgets: WidgetConfig[];
  updatedAt: Date;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "healthScore", enabled: true, order: 0 },
  { id: "stats", enabled: true, order: 1 },
  { id: "todaysMedications", enabled: true, order: 2 },
  { id: "recentSymptoms", enabled: true, order: 3 },
  { id: "healthInsights", enabled: true, order: 4 },
  { id: "alerts", enabled: true, order: 5 },
  { id: "familyMembers", enabled: true, order: 6 },
  { id: "quickActions", enabled: true, order: 7 },
];

class DashboardWidgetService {
  /**
   * Get dashboard configuration for a user
   */
  async getDashboardConfig(userId: string): Promise<DashboardConfig> {
    try {
      const docRef = doc(db, "dashboardConfigs", userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          userId,
          widgets: data.widgets || DEFAULT_WIDGETS,
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }

      // Return default config if none exists
      return {
        userId,
        widgets: DEFAULT_WIDGETS,
        updatedAt: new Date(),
      };
    } catch (error) {
      // Return default config on error
      return {
        userId,
        widgets: DEFAULT_WIDGETS,
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Save dashboard configuration
   */
  async saveDashboardConfig(config: DashboardConfig): Promise<void> {
    try {
      const docRef = doc(db, "dashboardConfigs", config.userId);

      // Ensure widgets array is valid
      if (!(config.widgets && Array.isArray(config.widgets))) {
        throw new Error("Invalid widgets configuration");
      }

      // Prepare data for Firestore - convert Date to Timestamp
      const firestoreData = {
        userId: config.userId,
        widgets: config.widgets,
        updatedAt: Timestamp.now(),
      };

      await setDoc(docRef, firestoreData, { merge: true });
    } catch (error: any) {
      // Provide more detailed error message
      const errorMessage = error?.message || "Unknown error";
      throw new Error(
        `Failed to save dashboard configuration: ${errorMessage}`
      );
    }
  }

  /**
   * Update widget order
   */
  async updateWidgetOrder(
    userId: string,
    widgetOrders: { id: WidgetId; order: number }[]
  ): Promise<void> {
    const config = await this.getDashboardConfig(userId);
    const widgetMap = new Map(widgetOrders.map((w) => [w.id, w.order]));

    config.widgets = config.widgets.map((widget) => ({
      ...widget,
      order: widgetMap.get(widget.id) ?? widget.order,
    }));

    // Sort by order
    config.widgets.sort((a, b) => a.order - b.order);

    await this.saveDashboardConfig(config);
  }

  /**
   * Toggle widget visibility
   */
  async toggleWidget(
    userId: string,
    widgetId: WidgetId,
    enabled: boolean
  ): Promise<void> {
    const config = await this.getDashboardConfig(userId);
    config.widgets = config.widgets.map((widget) =>
      widget.id === widgetId ? { ...widget, enabled } : widget
    );

    await this.saveDashboardConfig(config);
  }

  /**
   * Update widget size
   */
  async updateWidgetSize(
    userId: string,
    widgetId: WidgetId,
    size: "small" | "medium" | "large"
  ): Promise<void> {
    const config = await this.getDashboardConfig(userId);
    config.widgets = config.widgets.map((widget) =>
      widget.id === widgetId ? { ...widget, size } : widget
    );

    await this.saveDashboardConfig(config);
  }

  /**
   * Reset to default configuration
   */
  async resetToDefault(userId: string): Promise<void> {
    const config: DashboardConfig = {
      userId,
      widgets: DEFAULT_WIDGETS,
      updatedAt: new Date(),
    };

    await this.saveDashboardConfig(config);
  }

  /**
   * Get enabled widgets sorted by order
   */
  getEnabledWidgets(config: DashboardConfig): WidgetConfig[] {
    return config.widgets
      .filter((widget) => widget.enabled)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get widget display name
   */
  getWidgetName(widgetId: WidgetId, isRTL: boolean): string {
    const names: Record<WidgetId, { en: string; ar: string }> = {
      healthScore: { en: "Health Score", ar: "نقاط الصحة" },
      stats: { en: "Statistics", ar: "الإحصائيات" },
      recentSymptoms: { en: "Recent Symptoms", ar: "الأعراض الأخيرة" },
      todaysMedications: { en: "Today's Medications", ar: "أدوية اليوم" },
      healthInsights: { en: "Health Insights", ar: "رؤى صحية" },
      alerts: { en: "Alerts", ar: "التنبيهات" },
      familyMembers: { en: "Family Members", ar: "أفراد العائلة" },
      quickActions: { en: "Quick Actions", ar: "إجراءات سريعة" },
    };

    return isRTL ? names[widgetId].ar : names[widgetId].en;
  }
}

export const dashboardWidgetService = new DashboardWidgetService();
