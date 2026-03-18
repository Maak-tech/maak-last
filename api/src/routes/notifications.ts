import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { pushTokens, notificationTemplates, familyMembers, orgMembers } from "../db/schema";

export const notificationRoutes = new Elysia({ prefix: "/api/notifications" })
  .use(requireAuth)

  // Register Expo push token
  .post(
    "/push-token",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();

      // Deactivate any existing token for this device
      if (body.deviceId) {
        await db
          .update(pushTokens)
          .set({ isActive: false })
          .where(and(eq(pushTokens.userId, userId), eq(pushTokens.deviceId, body.deviceId)));
      }

      const [created] = await db
        .insert(pushTokens)
        .values({
          id,
          userId,
          token: body.token,
          platform: body.platform,
          deviceId: body.deviceId,
          deviceName: body.deviceName,
          isActive: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [pushTokens.token],
          set: { userId, platform: body.platform, deviceId: body.deviceId, isActive: true, updatedAt: new Date() },
        })
        .returning();

      return { ok: true, tokenId: created.id };
    },
    {
      body: t.Object({
        token: t.String(),
        platform: t.Union([t.Literal("ios"), t.Literal("android"), t.Literal("web")]),
        deviceId: t.Optional(t.String()),
        deviceName: t.Optional(t.String()),
      }),
      detail: { tags: ["notifications"], summary: "Register Expo push token" },
    }
  )

  // Send push notification to a list of users (mobile-initiated family / caregiver alerts)
  // Looks up active Expo push tokens for the given userIds and forwards to Expo Push Service.
  // Authorization: recipients must be in the same family as the calling user, or the calling
  // user must be themselves included in the list (self-notification).
  .post(
    "/send",
    async ({ db, userId, body, set }) => {
      if (!body.userIds.length) return { sent: 0 };

      // Verify caller is in a family; then restrict recipients to same-family members only.
      // This prevents any authenticated user from spamming arbitrary userIds.
      const [myMembership] = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, userId))
        .limit(1);

      let authorizedUserIds: string[];

      if (myMembership) {
        // Intersect requested userIds with confirmed members of the caller's family.
        // userId itself is also always allowed (self-notification case).
        const familyMatches = await db
          .select({ userId: familyMembers.userId })
          .from(familyMembers)
          .where(
            and(
              eq(familyMembers.familyId, myMembership.familyId),
              inArray(familyMembers.userId, body.userIds)
            )
          );
        const familyIds = familyMatches.map((m: { userId: string }) => m.userId);
        // Also allow sending to self even if not in any family
        authorizedUserIds = [...new Set([...familyIds, ...(body.userIds.includes(userId) ? [userId] : [])])];
      } else {
        // Caller is not in any family — only allow self-notification
        authorizedUserIds = body.userIds.includes(userId) ? [userId] : [];
      }

      if (authorizedUserIds.length === 0) {
        set.status = 403;
        return { error: "None of the specified userIds are in your family" };
      }

      const tokens = await db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(
          and(
            inArray(pushTokens.userId, authorizedUserIds),
            eq(pushTokens.isActive, true)
          )
        );

      if (!tokens.length) return { sent: 0 };

      const messages = tokens.map(({ token }) => ({
        to: token,
        sound: body.notification.sound ?? "default",
        title: body.notification.title,
        body: body.notification.body,
        data: body.notification.data ?? {},
        priority: body.notification.priority === "high" ? "high" : "default",
      }));

      const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(messages),
      });

      if (!expoResponse.ok) {
        console.error("[notifications/send] Expo error:", await expoResponse.text());
        return { sent: 0 };
      }

      return { sent: messages.length };
    },
    {
      body: t.Object({
        userIds: t.Array(t.String()),
        notification: t.Object({
          title: t.String(),
          body: t.String(),
          data: t.Optional(t.Record(t.String(), t.Unknown())),
          sound: t.Optional(t.String()),
          priority: t.Optional(
            t.Union([t.Literal("normal"), t.Literal("high")])
          ),
        }),
      }),
      detail: {
        tags: ["notifications"],
        summary: "Send Expo push notification to a list of users",
      },
    }
  )

  // Deregister push token on logout
  .delete(
    "/push-token/:token",
    async ({ db, userId, params }) => {
      await db
        .update(pushTokens)
        .set({ isActive: false })
        .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, params.token)));
      return { ok: true };
    },
    {
      params: t.Object({ token: t.String() }),
      detail: { tags: ["notifications"], summary: "Deregister push token on logout" },
    }
  )

  // Send a transactional email via SendGrid.
  // The API key is kept server-side — the mobile/web client never touches it.
  // Emails are sent synchronously within the request; the returned `id` is a
  // client-correlation UUID that can be used to log / trace the send.
  .post(
    "/email",
    async ({ body, set }) => {
      const apiKey = process.env.SENDGRID_API_KEY ?? "";
      const fromEmail = process.env.FROM_EMAIL ?? "noreply@nuralix.ai";

      if (!apiKey) {
        // In local development (no key configured) log and return success
        // so callers don't need special-case dev handling.
        console.warn("[notifications/email] SENDGRID_API_KEY not set — email skipped");
        return { id: crypto.randomUUID(), status: "skipped" };
      }

      const jobId = crypto.randomUUID();

      const sgPayload = {
        personalizations: [
          {
            to: body.to.map((email) => ({ email })),
            ...(body.cc?.length ? { cc: body.cc.map((email) => ({ email })) } : {}),
          },
        ],
        from: { email: fromEmail, name: "Nuralix" },
        subject: body.subject,
        content: [
          { type: "text/html", value: body.bodyHtml },
          ...(body.bodyText ? [{ type: "text/plain", value: body.bodyText }] : []),
        ],
      };

      const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sgPayload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!sgRes.ok) {
        const errText = await sgRes.text();
        console.error("[notifications/email] SendGrid error:", sgRes.status, errText);
        set.status = 502;
        return { error: "Email delivery failed. Please try again." };
      }

      return { id: jobId, status: "delivered" };
    },
    {
      body: t.Object({
        to: t.Array(t.String({ maxLength: 254 }), { maxItems: 50 }),
        cc: t.Optional(t.Array(t.String({ maxLength: 254 }), { maxItems: 20 })),
        subject: t.String({ minLength: 1, maxLength: 998 }),
        bodyHtml: t.String({ maxLength: 100_000 }),
        bodyText: t.Optional(t.String({ maxLength: 100_000 })),
        channel: t.String(),
        orgId: t.Optional(t.String()),
        patientId: t.Optional(t.String()),
      }),
      detail: { tags: ["notifications"], summary: "Send a transactional email via SendGrid" },
    }
  )

  // Email status — emails are sent synchronously, so a completed /email call
  // implies delivery. This endpoint exists for client logging/correlation.
  .get(
    "/email/status/:jobId",
    async ({ params }) => {
      return { id: params.jobId, status: "delivered", attempts: 1 };
    },
    {
      params: t.Object({ jobId: t.String() }),
      detail: { tags: ["notifications"], summary: "Get email delivery status (correlation only)" },
    }
  )

  // ── Notification Templates ────────────────────────────────────────────────────

  /**
   * GET /api/notifications/templates/:orgId
   * Returns all saved templates for an org.
   * Requires any org membership role.
   */
  .get(
    "/templates/:orgId",
    async ({ db, userId, params, set }) => {
      const [membership] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, params.orgId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const rows = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.orgId, params.orgId));
      return rows;
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["notifications"], summary: "Get all notification templates for an org (org member)" },
    }
  )

  /**
   * GET /api/notifications/templates/:orgId/:type/:channel
   * Returns a single template by type and channel.
   * Requires any org membership role.
   */
  .get(
    "/templates/:orgId/:type/:channel",
    async ({ db, userId, params, set }) => {
      const [membership] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, params.orgId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      const [row] = await db
        .select()
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.orgId, params.orgId),
            eq(notificationTemplates.type, params.type),
            eq(notificationTemplates.channel, params.channel)
          )
        )
        .limit(1);

      if (!row) {
        set.status = 404;
        return { error: "Template not found" };
      }

      return row;
    },
    {
      params: t.Object({ orgId: t.String(), type: t.String(), channel: t.String() }),
      detail: { tags: ["notifications"], summary: "Get a single notification template" },
    }
  )

  /**
   * PUT /api/notifications/templates/:orgId
   * Upsert (save) a notification template for an org.
   * Requires org admin role.
   */
  .put(
    "/templates/:orgId",
    async ({ db, userId, params, body, set }) => {
      const [membership] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, params.orgId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can modify notification templates" };
      }

      // Try to find existing row
      const [existing] = await db
        .select({ id: notificationTemplates.id })
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.orgId, params.orgId),
            eq(notificationTemplates.type, body.type),
            eq(notificationTemplates.channel, body.channel)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(notificationTemplates)
          .set({
            titleTemplate: body.titleTemplate.trim(),
            bodyTemplate: body.bodyTemplate.trim(),
            language: body.language,
            isActive: body.isActive,
            updatedAt: new Date(),
          })
          .where(eq(notificationTemplates.id, existing.id));
      } else {
        await db.insert(notificationTemplates).values({
          orgId: params.orgId,
          type: body.type,
          channel: body.channel,
          titleTemplate: body.titleTemplate.trim(),
          bodyTemplate: body.bodyTemplate.trim(),
          language: body.language,
          isActive: body.isActive,
          updatedAt: new Date(),
        });
      }

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        type: t.String(),
        channel: t.String(),
        titleTemplate: t.String(),
        bodyTemplate: t.String(),
        language: t.Union([t.Literal("en"), t.Literal("ar")]),
        isActive: t.Boolean(),
      }),
      detail: { tags: ["notifications"], summary: "Upsert a notification template for an org" },
    }
  )

  /**
   * DELETE /api/notifications/templates/:orgId/:type/:channel
   * Resets a template to default by deleting the custom row.
   * Requires org admin role.
   */
  .delete(
    "/templates/:orgId/:type/:channel",
    async ({ db, userId, params, set }) => {
      const [membership] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, params.orgId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can delete notification templates" };
      }

      await db
        .delete(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.orgId, params.orgId),
            eq(notificationTemplates.type, params.type),
            eq(notificationTemplates.channel, params.channel)
          )
        );
      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), type: t.String(), channel: t.String() }),
      detail: { tags: ["notifications"], summary: "Reset a notification template to default (deletes custom row)" },
    }
  );
