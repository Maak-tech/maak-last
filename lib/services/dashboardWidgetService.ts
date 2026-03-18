/**
 * Dashboard widget service — Firebase-free replacement.
 *
 * Replaced Firestore `dashboardConfigs/{userId}` get/set with:
 *   GET   /api/user/preferences   → reads preferences.dashboardWidgets
 *   PATCH /api/user/preferences   → atomically merges dashboardWidgets key (race-condition-safe)
 *
 * Widget config is stored in the `users.preferences` JSONB column under the
 * `dashboardWidgets` key. Using PATCH with the jsonb || merge operator eliminates
 * the read-modify-write race condition that PUT (full overwrite) would create when
 * two concurrent callers update different preference keys simultaneously.
 */

import { api } from "@/lib/apiClient";

export type WidgetId =
  | "healthScore"
  | "stats"
  | "recentSymptoms"
  | "todaysMedications"
  | "healthInsights"
  | "alerts"
  | "familyMembers"
  | "quickActions";

export type WidgetConfig = {
  id: WidgetId;
  enabled: boolean;
  order: number;
  size?: "small" | "medium" | "large";
};

export type DashboardConfig = {
  userId: string;
  widgets: WidgetConfig[];
  updatedAt: Date;
};

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

type PreferencesResponse = {
  preferences: Record<string, unknown>;
};

class DashboardWidgetService {
  private async readWidgets(): Promise<WidgetConfig[]> {
    const res = await api.get<PreferencesResponse>("/api/user/preferences");
    const raw = res?.preferences?.dashboardWidgets;
    if (Array.isArray(raw)) return raw as WidgetConfig[];
    return DEFAULT_WIDGETS;
  }

  private async writeWidgets(widgets: WidgetConfig[]): Promise<void> {
    // Atomic server-side merge — no read needed.
    // The server uses Postgres jsonb || to update only the dashboardWidgets key
    // without overwriting other preference keys set by concurrent callers.
    await api.patch("/api/user/preferences", {
      updates: { dashboardWidgets: widgets },
    });
  }

  /** Get dashboard configuration for a user */
  async getDashboardConfig(userId: string): Promise<DashboardConfig> {
    try {
      const widgets = await this.readWidgets();
      return { userId, widgets, updatedAt: new Date() };
    } catch {
      return { userId, widgets: DEFAULT_WIDGETS, updatedAt: new Date() };
    }
  }

  /** Save dashboard configuration */
  async saveDashboardConfig(config: DashboardConfig): Promise<void> {
    if (!(config.widgets && Array.isArray(config.widgets))) {
      throw new Error("Invalid widgets configuration");
    }
    await this.writeWidgets(config.widgets);
  }

  /** Update widget order */
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
    config.widgets.sort((a, b) => a.order - b.order);

    await this.saveDashboardConfig(config);
  }

  /** Toggle widget visibility */
  async toggleWidget(
    userId: string,
    widgetId: WidgetId,
    enabled: boolean
  ): Promise<void> {
    const config = await this.getDashboardConfig(userId);
    config.widgets = config.widgets.map((w) =>
      w.id === widgetId ? { ...w, enabled } : w
    );
    await this.saveDashboardConfig(config);
  }

  /** Update widget size */
  async updateWidgetSize(
    userId: string,
    widgetId: WidgetId,
    size: "small" | "medium" | "large"
  ): Promise<void> {
    const config = await this.getDashboardConfig(userId);
    config.widgets = config.widgets.map((w) =>
      w.id === widgetId ? { ...w, size } : w
    );
    await this.saveDashboardConfig(config);
  }

  /** Reset to default configuration */
  async resetToDefault(userId: string): Promise<void> {
    await this.saveDashboardConfig({
      userId,
      widgets: DEFAULT_WIDGETS,
      updatedAt: new Date(),
    });
  }

  /** Get enabled widgets sorted by order */
  getEnabledWidgets(config: DashboardConfig): WidgetConfig[] {
    return config.widgets
      .filter((w) => w.enabled)
      .sort((a, b) => a.order - b.order);
  }

  /** Get widget display name */
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
