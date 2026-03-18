/**
 * Email Service
 *
 * Sends transactional and digest emails via SendGrid.
 * This is a client-side wrapper that queues email jobs via the REST API;
 * the actual send is handled server-side by the notifications worker.
 *
 * Email channels:
 *   weekly_report   — Provider weekly patient summary digest
 *   critical_alert  — Fallback when push/SMS for critical events fails
 *   patient_digest  — Patient-facing weekly health summary
 *   org_summary     — Org admin weekly operations report
 *
 * Pattern: POST /api/notifications/email → server queues and sends.
 * This keeps email credentials server-side and provides a built-in retry queue.
 */

import { api } from "@/lib/apiClient";
import type { EmailChannel } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailJobStatus = "pending" | "sent" | "failed" | "cancelled";

export type EmailJob = {
  id: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  channel: EmailChannel;
  orgId?: string;
  patientId?: string;
  status: EmailJobStatus;
  attempts: number;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
};

// ─── HTML Templates ───────────────────────────────────────────────────────────

/**
 * Build a branded HTML email wrapper around content.
 * Org branding (logo, colors) can be passed in for customization.
 */
export function buildEmailHtml(params: {
  title: string;
  bodyHtml: string;
  orgName?: string;
  primaryColor?: string;
  footerText?: string;
}): string {
  const {
    title,
    bodyHtml,
    orgName = "Nuralix",
    primaryColor = "#2563EB",
    footerText,
  } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #FFFFFF; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { border-bottom: 3px solid ${primaryColor}; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; color: ${primaryColor}; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #6B7280; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-red { background: #FEE2E2; color: #DC2626; }
    .badge-yellow { background: #FEF3C7; color: #D97706; }
    .badge-green { background: #D1FAE5; color: #059669; }
    .badge-blue { background: #DBEAFE; color: #2563EB; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { text-align: left; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    td { padding: 10px 0; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>${orgName}</h1>
        <p>${title}</p>
      </div>
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>${footerText ?? `This email was sent by ${orgName} via Nuralix. Do not reply to this email.`}</p>
      <p>© ${new Date().getFullYear()} Nuralix. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Template Builders ────────────────────────────────────────────────────────

/**
 * Build the weekly provider patient summary email body.
 */
export function buildWeeklyProviderDigest(params: {
  providerName: string;
  orgName: string;
  totalPatients: number;
  criticalCount: number;
  highRiskCount: number;
  newAlertsCount: number;
  topPatients: Array<{
    name: string;
    riskLevel: string;
    lastSync: string;
    anomalyCount: number;
  }>;
}): { subject: string; bodyHtml: string } {
  const {
    providerName,
    orgName,
    totalPatients,
    criticalCount,
    highRiskCount,
    newAlertsCount,
    topPatients,
  } = params;

  const now = new Date();
  const weekStr = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const patientRows = topPatients
    .map(
      (p) => `<tr>
        <td>${p.name}</td>
        <td><span class="badge badge-${p.riskLevel === "critical" ? "red" : p.riskLevel === "high" ? "yellow" : "green"}">${p.riskLevel}</span></td>
        <td>${p.anomalyCount}</td>
        <td>${p.lastSync}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p>Hello ${providerName},</p>
    <p>Here is your weekly patient summary for <strong>${orgName}</strong> — week of ${weekStr}.</p>

    <table>
      <tr>
        <th>Stat</th>
        <th>Count</th>
      </tr>
      <tr><td>Total active patients</td><td>${totalPatients}</td></tr>
      <tr><td>Critical risk patients</td><td><strong style="color:#DC2626">${criticalCount}</strong></td></tr>
      <tr><td>High risk patients</td><td><strong style="color:#D97706">${highRiskCount}</strong></td></tr>
      <tr><td>New alerts this week</td><td>${newAlertsCount}</td></tr>
    </table>

    ${
      topPatients.length > 0
        ? `<h3 style="font-size:15px;margin-bottom:8px">Patients needing attention</h3>
           <table>
             <tr>
               <th>Patient</th><th>Risk</th><th>Anomalies</th><th>Last Sync</th>
             </tr>
             ${patientRows}
           </table>`
        : "<p>No high-risk patients this week. Great work!</p>"
    }

    <p>Log in to Nuralix to view full details and acknowledge alerts.</p>
  `;

  return {
    subject: `[${orgName}] Weekly Patient Summary — ${weekStr}`,
    bodyHtml,
  };
}

/**
 * Build a critical alert fallback email body.
 */
export function buildCriticalAlertEmail(params: {
  patientName: string;
  alertType: string;
  details: string;
  orgName: string;
}): { subject: string; bodyHtml: string } {
  const { patientName, alertType, details, orgName } = params;

  return {
    subject: `[URGENT] Critical alert for ${patientName} — ${orgName}`,
    bodyHtml: `
      <p><span class="badge badge-red">CRITICAL</span></p>
      <p>A critical health alert has been detected for your patient:</p>
      <table>
        <tr><th>Patient</th><td>${patientName}</td></tr>
        <tr><th>Alert type</th><td>${alertType}</td></tr>
        <tr><th>Details</th><td>${details}</td></tr>
        <tr><th>Time</th><td>${new Date().toLocaleString()}</td></tr>
      </table>
      <p>Please log in to Nuralix immediately to review and acknowledge this alert.</p>
    `,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class EmailService {
  /**
   * Queue an email for delivery via the REST API.
   * The server worker picks it up and sends via SendGrid.
   */
  async queueEmail(params: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    channel: EmailChannel;
    orgId?: string;
    patientId?: string;
  }): Promise<string> {
    const res = await api.post("/api/notifications/email", {
      to: params.to,
      cc: params.cc ?? [],
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      bodyText: params.bodyText ?? undefined,
      channel: params.channel,
      orgId: params.orgId ?? undefined,
      patientId: params.patientId ?? undefined,
    }) as { id: string; status: string };
    return res.id;
  }

  /**
   * Queue a weekly provider digest email.
   */
  async sendWeeklyProviderDigest(params: {
    providerEmail: string;
    providerName: string;
    orgId: string;
    orgName: string;
    primaryColor?: string;
    summaryData: Parameters<typeof buildWeeklyProviderDigest>[0];
  }): Promise<string> {
    const { subject, bodyHtml: bodyContent } = buildWeeklyProviderDigest(
      params.summaryData
    );

    const html = buildEmailHtml({
      title: subject,
      bodyHtml: bodyContent,
      orgName: params.orgName,
      primaryColor: params.primaryColor,
    });

    return this.queueEmail({
      to: [params.providerEmail],
      subject,
      bodyHtml: html,
      channel: "weekly_report",
      orgId: params.orgId,
    });
  }

  /**
   * Queue a critical alert fallback email.
   */
  async sendCriticalAlertFallback(params: {
    providerEmails: string[];
    orgId: string;
    orgName: string;
    patientId: string;
    patientName: string;
    alertType: string;
    details: string;
    primaryColor?: string;
  }): Promise<string> {
    const { subject, bodyHtml: bodyContent } = buildCriticalAlertEmail({
      patientName: params.patientName,
      alertType: params.alertType,
      details: params.details,
      orgName: params.orgName,
    });

    const html = buildEmailHtml({
      title: subject,
      bodyHtml: bodyContent,
      orgName: params.orgName,
      primaryColor: params.primaryColor,
    });

    return this.queueEmail({
      to: params.providerEmails,
      subject,
      bodyHtml: html,
      channel: "critical_alert",
      orgId: params.orgId,
      patientId: params.patientId,
    });
  }

  /**
   * List recent email jobs for an org (for diagnostics/settings UI).
   * Fetches job status by ID from the REST API.
   */
  async listRecentJobs(orgId: string, maxResults = 20): Promise<EmailJob[]> {
    // The REST API currently exposes per-job status lookup only.
    // Org-level listing is not yet implemented; return empty until the
    // email_jobs table and GET /api/notifications/email?orgId= are added.
    void orgId;
    void maxResults;
    return [];
  }
}

export const emailService = new EmailService();
