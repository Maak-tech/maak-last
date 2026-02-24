/**
 * Notification Template Service
 *
 * Manages org-branded push / SMS notification templates.
 * Templates are stored at: organizations/{orgId}/notification_templates/{type}
 *
 * Templates support {{patient.firstName}}, {{vital.type}}, {{value}}
 * as runtime substitution tokens (resolved at send time by the agent cycle
 * and critical-alert trigger).
 *
 * Defaults are provided for each template type so orgs without custom
 * templates still get sensible copy.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
    body: "Hi {{patient.firstName}}, your wearable hasn't synced in a while. Please open Maak to update your health data.",
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

// ─── Firestore Helpers ────────────────────────────────────────────────────────

function templateDocRef(
  orgId: string,
  type: NotificationTemplateType,
  channel: NotificationChannel
) {
  return doc(
    db,
    "organizations",
    orgId,
    "notification_templates",
    `${type}_${channel}`
  );
}

function mapTemplate(
  orgId: string,
  data: Record<string, unknown>
): NotificationTemplate {
  const ts = data.updatedAt as { toDate?: () => Date } | undefined;
  return {
    orgId,
    type: data.type as NotificationTemplateType,
    channel: data.channel as NotificationChannel,
    titleTemplate: data.titleTemplate as string,
    bodyTemplate: data.bodyTemplate as string,
    language: (data.language as "en" | "ar") ?? "en",
    isActive: (data.isActive as boolean) ?? true,
    updatedAt: ts?.toDate ? ts.toDate() : undefined,
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
    const snap = await getDocs(
      collection(db, "organizations", orgId, "notification_templates")
    );

    const saved: Record<string, NotificationTemplate> = {};
    for (const d of snap.docs) {
      const data = d.data();
      const key = d.id; // e.g. "critical_alert_push"
      saved[key] = mapTemplate(orgId, data);
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
        if (saved[key]) {
          result[key] = saved[key];
        } else {
          const def = DEFAULT_TEMPLATES[type];
          result[key] = {
            orgId,
            type,
            channel,
            titleTemplate: def.title,
            bodyTemplate: def.body,
            language: "en",
            isActive: true,
          };
        }
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
    const snap = await getDoc(templateDocRef(orgId, type, channel));
    if (!snap.exists()) {
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
    return mapTemplate(orgId, snap.data());
  }

  /**
   * Save (upsert) a notification template.
   */
  async saveTemplate(orgId: string, params: SaveTemplateParams): Promise<void> {
    const ref = templateDocRef(orgId, params.type, params.channel);
    await setDoc(ref, {
      orgId,
      type: params.type,
      channel: params.channel,
      titleTemplate: params.titleTemplate.trim(),
      bodyTemplate: params.bodyTemplate.trim(),
      language: params.language,
      isActive: params.isActive,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Reset a template back to the system default by deleting the custom doc.
   * The next read will return the default template.
   */
  async resetToDefault(
    orgId: string,
    type: NotificationTemplateType,
    channel: NotificationChannel
  ): Promise<void> {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(templateDocRef(orgId, type, channel));
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
