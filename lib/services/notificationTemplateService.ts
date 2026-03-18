/**
 * Notification Template Service
 *
 * Manages org-branded push / SMS notification templates.
 * Templates are stored at: /api/notifications/templates/{orgId}
 *
 * Templates support {{patient.firstName}}, {{vital.type}}, {{value}}
 * as runtime substitution tokens (resolved at send time by the agent cycle
 * and critical-alert trigger).
 *
 * Defaults are provided for each template type so orgs without custom
 * templates still get sensible copy.
 */

import { api } from "@/lib/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationTemplateType =
  | "critical_alert"
  | "medication_missed"
  | "vital_stale"
  | "risk_nudge"
  | "task_assigned";

export type NotificationChannel = "push" | "sms";

export type NotificationTemplate = {
  /** Org that owns this template */
  orgId: string;
  /** Alert / event category */
  type: NotificationTemplateType;
  /** Delivery channel */
  channel: NotificationChannel;
  /** Push title / SMS subject (max 80 chars) */
  titleTemplate: string;
  /** Push body / SMS body (max 240 chars) */
  bodyTemplate: string;
  /** Display language */
  language: "en" | "ar";
  isActive: boolean;
  updatedAt?: Date;
};

export type SaveTemplateParams = Omit<
  NotificationTemplate,
  "orgId" | "updatedAt"
>;

// ─── Default Templates ────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Record<
  NotificationTemplateType,
  { title: string; body: string }
> = {
  critical_alert: {
    title: "🚨 Critical Alert: {{vital.type}}",
    body: "{{patient.firstName}}'s {{vital.type}} reading requires immediate attention. Please review their health timeline.",
  },
  medication_missed: {
    title: "💊 Missed Medication Reminder",
    body: "Hi {{patient.firstName}}, you haven't logged your medication today. Staying on track helps your care team support you.",
  },
  vital_stale: {
    title: "📡 Health Data Sync Needed",
    body: "Hi {{patient.firstName}}, your wearable hasn't synced in a while. Please open Nuralix to update your health data.",
  },
  risk_nudge: {
    title: "💙 Check-In From Your Care Team",
    body: "Hi {{patient.firstName}}, your care team wanted to check in. Open the app to see your latest health insights.",
  },
  task_assigned: {
    title: "📋 New Task From Your Care Team",
    body: "Hi {{patient.firstName}}, your care coordinator has assigned you a new task. Tap to view details.",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RawTemplateRow = {
  id?: string;
  orgId: string;
  type: string;
  channel: string;
  titleTemplate: string;
  bodyTemplate: string;
  language: string;
  isActive: boolean;
  updatedAt?: string | null;
};

function mapRow(row: RawTemplateRow): NotificationTemplate {
  return {
    orgId: row.orgId,
    type: row.type as NotificationTemplateType,
    channel: row.channel as NotificationChannel,
    titleTemplate: row.titleTemplate,
    bodyTemplate: row.bodyTemplate,
    language: (row.language as "en" | "ar") ?? "en",
    isActive: row.isActive ?? true,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
  };
}

function defaultTemplate(
  orgId: string,
  type: NotificationTemplateType,
  channel: NotificationChannel
): NotificationTemplate {
  const def = DEFAULT_TEMPLATES[type];
  return {
    orgId,
    type,
    channel,
    titleTemplate: def.title,
    bodyTemplate: def.body,
    language: "en",
    isActive: true,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class NotificationTemplateService {
  /**
   * Load all notification templates for an org.
   * Returns default templates for any type that has not been customized.
   */
  async getOrgTemplates(
    orgId: string
  ): Promise<Record<string, NotificationTemplate>> {
    const rows = await api.get(
      `/api/notifications/templates/${encodeURIComponent(orgId)}`
    ) as RawTemplateRow[];

    const saved: Record<string, NotificationTemplate> = {};
    for (const row of rows) {
      const key = `${row.type}_${row.channel}`;
      saved[key] = mapRow(row);
    }

    // Merge with defaults so every type has a value
    const types: NotificationTemplateType[] = [
      "critical_alert",
      "medication_missed",
      "vital_stale",
      "risk_nudge",
      "task_assigned",
    ];
    const channels: NotificationChannel[] = ["push"];

    const result: Record<string, NotificationTemplate> = {};
    for (const type of types) {
      for (const channel of channels) {
        const key = `${type}_${channel}`;
        result[key] = saved[key] ?? defaultTemplate(orgId, type, channel);
      }
    }

    return result;
  }

  /**
   * Load a single template for a given type + channel.
   * Returns the default if no custom template has been saved.
   */
  async getTemplate(
    orgId: string,
    type: NotificationTemplateType,
    channel: NotificationChannel
  ): Promise<NotificationTemplate> {
    try {
      const row = await api.get(
        `/api/notifications/templates/${encodeURIComponent(orgId)}/${type}/${channel}`
      ) as RawTemplateRow;
      return mapRow(row);
    } catch {
      return defaultTemplate(orgId, type, channel);
    }
  }

  /**
   * Save (upsert) a notification template.
   */
  async saveTemplate(orgId: string, params: SaveTemplateParams): Promise<void> {
    await api.patch(
      `/api/notifications/templates/${encodeURIComponent(orgId)}`,
      {
        type: params.type,
        channel: params.channel,
        titleTemplate: params.titleTemplate,
        bodyTemplate: params.bodyTemplate,
        language: params.language,
        isActive: params.isActive,
      }
    );
  }

  /**
   * Reset a template back to the system default by deleting the custom row.
   * The next read will return the default template.
   */
  async resetToDefault(
    orgId: string,
    type: NotificationTemplateType,
    channel: NotificationChannel
  ): Promise<void> {
    await api.delete(
      `/api/notifications/templates/${encodeURIComponent(orgId)}/${type}/${channel}`
    );
  }

  /**
   * Apply runtime token substitution to a template string.
   * Supported tokens: {{patient.firstName}}, {{vital.type}}, {{value}}, {{orgName}}
   */
  applyTokens(
    template: string,
    tokens: {
      patientFirstName?: string;
      vitalType?: string;
      value?: string | number;
      orgName?: string;
    }
  ): string {
    return template
      .replace(
        /\{\{patient\.firstName\}\}/g,
        tokens.patientFirstName ?? "there"
      )
      .replace(/\{\{vital\.type\}\}/g, tokens.vitalType ?? "vital sign")
      .replace(/\{\{value\}\}/g, tokens.value?.toString() ?? "—")
      .replace(/\{\{orgName\}\}/g, tokens.orgName ?? "your care team");
  }
}

export const notificationTemplateService = new NotificationTemplateService();
