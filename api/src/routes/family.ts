import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { logger } from "../lib/logger.js";
import { buildUserObject } from "../services/userBuilder.js";
import { families, familyMembers, familyInvitations, familyHealthSummary, vhi, genetics, alerts, users, caregiverNotes, patientConsents } from "../db/schema";

export const familyRoutes = new Elysia({ prefix: "/api/family" })
  .use(requireAuth)

  // Get current user's family
  .get(
    "/me",
    async ({ db, userId }) => {
      const [member] = await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.userId, userId))
        .limit(1);

      if (!member) return null;

      const [family] = await db
        .select()
        .from(families)
        .where(eq(families.id, member.familyId))
        .limit(1);

      return { family, role: member.role };
    },
    { detail: { tags: ["family"], summary: "Get current user's family" } }
  )

  // Get all family members (admin-level view with VHI data)
  .get(
    "/:familyId/members",
    async ({ db, userId, params, set }) => {
      // Verify requesting user is an admin of this family — prevents any
      // authenticated user from reading another family's PHI.
      const [adminCheck] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, params.familyId)))
        .limit(1);

      if (!adminCheck) {
        set.status = 403;
        return { error: "You are not a member of this family" };
      }
      if (adminCheck.role !== "admin") {
        set.status = 403;
        return { error: "Only family admins can view all member details" };
      }

      const members = await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.familyId, params.familyId));

      if (members.length === 0) return [];

      // Collect all member user IDs once so we can issue 3 bulk queries instead
      // of 3 per-member queries (O(1) round trips vs O(N) — avoids N+1 pattern).
      const memberUserIds = members.map((m) => m.userId);

      // Fetch VHI, alerts, and genetics for ALL members in 3 parallel queries.
      // Promise.allSettled is used so that a failure in one data source (e.g.
      // genetics table down) still returns VHI and alerts rather than failing
      // the whole endpoint — the same fault-isolation goal as the old per-member
      // try/catch, but now with just 3 round trips instead of 3N.
      const [vhiResult, alertsResult, geneticsResult] = await Promise.allSettled([
        db.select().from(vhi).where(inArray(vhi.userId, memberUserIds)),

        // Cap at 10 unacknowledged alerts per member to bound result set size
        // (memberUserIds.length × 10). Sliced to 5 per member in the map below.
        db
          .select()
          .from(alerts)
          .where(and(inArray(alerts.userId, memberUserIds), eq(alerts.isAcknowledged, false)))
          .limit(memberUserIds.length * 10),

        db
          .select({
            userId: genetics.userId,
            prsScores: genetics.prsScores,
            pharmacogenomics: genetics.pharmacogenomics,
            twinRelevantConditions: genetics.twinRelevantConditions,
            familySharingConsent: genetics.familySharingConsent,
          })
          .from(genetics)
          .where(inArray(genetics.userId, memberUserIds)),
      ]);

      if (vhiResult.status === 'rejected') {
        logger.error({ err: vhiResult.reason }, '[family/members] VHI batch query failed');
      }
      if (alertsResult.status === 'rejected') {
        logger.error({ err: alertsResult.reason }, '[family/members] Alerts batch query failed');
      }
      if (geneticsResult.status === 'rejected') {
        logger.error({ err: geneticsResult.reason }, '[family/members] Genetics batch query failed');
      }

      const allVhi      = vhiResult.status      === 'fulfilled' ? vhiResult.value      : [];
      const allAlerts   = alertsResult.status   === 'fulfilled' ? alertsResult.value   : [];
      const allGenetics = geneticsResult.status === 'fulfilled' ? geneticsResult.value : [];

      // Build O(1) lookup maps to avoid repeated linear scans during the map below.
      const vhiByUserId = new Map(allVhi.map((v) => [v.userId, v]));
      const alertsByUserId = new Map<string, typeof allAlerts>();
      for (const alert of allAlerts) {
        if (!alertsByUserId.has(alert.userId)) alertsByUserId.set(alert.userId, []);
        alertsByUserId.get(alert.userId)!.push(alert);
      }
      const geneticsByUserId = new Map(allGenetics.map((g) => [g.userId, g]));

      // Minor protection: fetch guardianId for all members in a single query,
      // then determine which minors (guardianId set) the caller may NOT access.
      const guardianRows = await db
        .select({ id: users.id, guardianId: users.guardianId })
        .from(users)
        .where(inArray(users.id, memberUserIds));

      // Collect IDs of minors whose guardian is someone else AND no consent exists.
      // Filter to only rows where caller is NOT the guardian — these are the only ones
      // that require a consent check.
      const uncheckedMinors = guardianRows.filter(
        (row) => row.guardianId && row.guardianId !== userId
      );

      // Single batched query for all consents instead of one query per minor (avoids N+1).
      const uncheckedMinorIds = uncheckedMinors.map((row) => row.id);
      const consentRows = uncheckedMinorIds.length > 0
        ? await db
            .select({ userId: patientConsents.userId })
            .from(patientConsents)
            .where(
              and(
                inArray(patientConsents.userId, uncheckedMinorIds),
                eq(patientConsents.isActive, true),
                sql`${patientConsents.scope} @> ARRAY['family_data_sharing']`
              )
            )
        : [];

      const consentedMinorIds = new Set(consentRows.map((c) => c.userId));

      const blockedMemberIds = new Set<string>();
      for (const row of uncheckedMinors) {
        if (!consentedMinorIds.has(row.id)) {
          blockedMemberIds.add(row.id);
        }
      }

      // Assemble per-member dashboard objects from the pre-fetched data.
      const memberData = members.map((member) => {
        // Skip minors whose guardian has not consented to family data sharing
        if (blockedMemberIds.has(member.userId)) return null;
        const memberVhi = vhiByUserId.get(member.userId);
        const recentAlerts = (alertsByUserId.get(member.userId) ?? []).slice(0, 5);
        const memberGenetics = geneticsByUserId.get(member.userId);

        return {
          memberId: member.userId,
          role: member.role,
          vhiScore: memberVhi?.data?.currentState?.overallScore ?? null,
          vhiTrajectory: memberVhi?.data?.currentState?.riskScores?.trajectory ?? null,
          compositeRisk: memberVhi?.data?.currentState?.riskScores?.compositeRisk ?? null,
          topDecliningFactors: memberVhi?.data?.decliningFactors?.slice(0, 3) ?? [],
          pendingActions: memberVhi?.data?.pendingActions ?? [],
          recentAlerts,
          // Genetic summary (masked: no rsids, only condition-level summary)
          geneticRiskSummary:
            memberGenetics?.familySharingConsent
              ? {
                  conditions: (Array.isArray(memberGenetics.prsScores) ? memberGenetics.prsScores as Array<{condition: string; percentile: number; level: string}> : []).map(({ condition, percentile, level }) => ({
                    condition,
                    percentile,
                    level,
                  })),
                  pharmacogenomicsAlerts: (Array.isArray(memberGenetics.pharmacogenomics) ? memberGenetics.pharmacogenomics as Array<{drug: string; interaction: string}> : []),
                }
              : null,
        };
      });

      return memberData.filter(Boolean);
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Caregiver dashboard — all family members with VHI" },
    }
  )

  // Get family health summary — one query for all members' latest health status.
  // Replaces N×8 per-member queries that happen on the caregiver dashboard.
  .get(
    "/:familyId/health-summary",
    async ({ db, userId, params, set }) => {
      // Verify the caller is a member of this family
      const [membership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, params.familyId), eq(familyMembers.userId, userId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "Not a member of this family" };
      }

      const summaries = await db
        .select()
        .from(familyHealthSummary)
        .where(eq(familyHealthSummary.familyId, params.familyId))
        .orderBy(desc(familyHealthSummary.updatedAt));

      return { summaries };
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Get family health summary — all members in one query" },
    }
  )

  // Acknowledge an alert for a family member (admin only)
  .post(
    "/alerts/:alertId/acknowledge",
    async ({ db, userId, params, set }) => {
      // Fetch the alert to find who it belongs to
      const [alert] = await db
        .select({ userId: alerts.userId })
        .from(alerts)
        .where(eq(alerts.id, params.alertId))
        .limit(1);

      if (!alert) {
        set.status = 404;
        return { error: "Alert not found" };
      }

      // Allow: self-acknowledgment, or an admin of the same family
      if (alert.userId !== userId) {
        const [myMembership] = await db
          .select({ role: familyMembers.role, familyId: familyMembers.familyId })
          .from(familyMembers)
          .where(eq(familyMembers.userId, userId))
          .limit(1);

        if (myMembership?.role !== "admin") {
          set.status = 403;
          return { error: "Only family admins can acknowledge alerts for other members" };
        }

        // Verify the alert's owner is in the SAME family
        const [targetMembership] = await db
          .select({ familyId: familyMembers.familyId })
          .from(familyMembers)
          .where(eq(familyMembers.userId, alert.userId))
          .limit(1);

        if (!targetMembership || targetMembership.familyId !== myMembership.familyId) {
          set.status = 403;
          return { error: "You can only acknowledge alerts for members of your own family" };
        }
      }

      const [updated] = await db
        .update(alerts)
        .set({ isAcknowledged: true, acknowledgedBy: userId, acknowledgedAt: new Date() })
        .where(eq(alerts.id, params.alertId))
        .returning();
      return updated;
    },
    {
      params: t.Object({ alertId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Acknowledge a family member's alert" },
    }
  )

  // ── GET family members as User objects (basic profile data for userService.getFamilyMembers) ──
  .get(
    "/:familyId/users",
    async ({ db, userId, params, query, set }) => {
      // Verify requesting user is a member of this family before returning user profiles
      const [myMembership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, params.familyId)))
        .limit(1);

      if (!myMembership) {
        set.status = 403;
        return { error: "You are not a member of this family" };
      }

      const members = await db
        .select()
        .from(familyMembers)
        .where(
          query.role
            ? and(eq(familyMembers.familyId, params.familyId), eq(familyMembers.role, query.role))
            : eq(familyMembers.familyId, params.familyId)
        );

      if (members.length === 0) return [];

      // Fetch all user profiles in a single query instead of one query per member
      // (avoids N+1 pattern; inArray generates a single WHERE id IN (...) clause).
      const memberUserIds = members.map((m) => m.userId);
      const userRows = await db
        .select()
        .from(users)
        .where(inArray(users.id, memberUserIds));

      // Build an O(1) lookup map keyed by user id for the join below.
      const userById = new Map(userRows.map((u) => [u.id, u]));

      // Build a lookup map for member roles (needed when a user belongs to
      // multiple families — the role is scoped to the current family).
      const roleByUserId = new Map(members.map((m) => [m.userId, m.role]));

      const result = memberUserIds
        .map((uid) => {
          const user = userById.get(uid);
          if (!user) return null;

          const memberRole = roleByUserId.get(uid);
          return buildUserObject({
            userRow: user,
            memberRow: memberRole != null ? { role: memberRole, sharingScope: members.find((m) => m.userId === uid)?.sharingScope ?? ['all'] } : null,
          });
        })
        .filter(Boolean);

      return result;
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      query: t.Object({ role: t.Optional(t.String({ minLength: 1, maxLength: 36 })) }),
      detail: { tags: ["family"], summary: "Get family members as User objects (basic profile)" },
    }
  )

  // ── POST create family ────────────────────────────────────────────────────────
  .post(
    "/create",
    async ({ db, userId, body }) => {
      const familyId = crypto.randomUUID();
      const memberId = crypto.randomUUID();

      await db.insert(families).values({
        id: familyId,
        name: body.name ?? "My Family",
        createdBy: userId,
      });

      await db.insert(familyMembers).values({
        id: memberId,
        familyId,
        userId,
        role: "admin",
      });

      // Update user's familyId in users table
      await db.update(users).set({ familyId, updatedAt: new Date() }).where(eq(users.id, userId));

      // Atomically merge role into preferences using Postgres JSONB operator
      // to avoid a SELECT-then-UPDATE race condition.
      await db.update(users).set({
        preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || '{"role":"admin"}'::jsonb`,
      }).where(eq(users.id, userId));

      return { id: familyId, name: body.name ?? "My Family" };
    },
    {
      body: t.Object({ name: t.Optional(t.String({ maxLength: 255 })) }),
      detail: { tags: ["family"], summary: "Create a new family (current user becomes admin)" },
    }
  )

  // ── POST join family ──────────────────────────────────────────────────────────
  .post(
    "/:familyId/join",
    async ({ db, userId, params, body, set }) => {
      const familyId = params.familyId;
      const targetUserId = body?.userId ?? userId;

      // Verify family exists
      const [family] = await db
        .select()
        .from(families)
        .where(eq(families.id, familyId))
        .limit(1);

      if (!family) {
        set.status = 404;
        return { error: "Family not found" };
      }

      // If adding someone else to the family, require admin role in this family
      if (targetUserId !== userId) {
        const [myMembership] = await db
          .select({ role: familyMembers.role })
          .from(familyMembers)
          .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, familyId)))
          .limit(1);

        if (myMembership?.role !== "admin") {
          set.status = 403;
          return { error: "Only family admins can add other users to the family" };
        }
      }

      // Determine role: creator becomes admin
      const role = family.createdBy === targetUserId ? "admin" : "member";

      // Upsert family membership
      const existingMembership = await db
        .select()
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, targetUserId)))
        .limit(1);

      if (existingMembership.length === 0) {
        await db.insert(familyMembers).values({
          id: crypto.randomUUID(),
          familyId,
          userId: targetUserId,
          role,
        });
      } else {
        await db.update(familyMembers).set({ role }).where(
          and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, targetUserId))
        );
      }

      // Update user's familyId
      await db.update(users).set({ familyId, updatedAt: new Date() }).where(eq(users.id, targetUserId));

      // Atomically merge role into preferences using Postgres JSONB operator
      // to avoid a SELECT-then-UPDATE race condition.
      await db.update(users).set({
        preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || ${JSON.stringify({ role })}::jsonb`,
      }).where(eq(users.id, targetUserId));

      return { ok: true, familyId, role };
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Optional(t.Object({ userId: t.Optional(t.String({ maxLength: 36 })) })),
      detail: { tags: ["family"], summary: "Join a family" },
    }
  )

  // ── POST leave family ─────────────────────────────────────────────────────────
  .post(
    "/:familyId/leave",
    async ({ db, userId, params }) => {
      const familyId = params.familyId;
      // Only allow self-leave. To remove another member, use DELETE /:familyId/members/:memberId.
      const targetUserId = userId;

      // Remove from familyMembers
      await db
        .delete(familyMembers)
        .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, targetUserId)));

      // Clear user's familyId
      await db.update(users).set({ familyId: null, updatedAt: new Date() }).where(eq(users.id, targetUserId));

      return { ok: true };
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Optional(t.Object({ userId: t.Optional(t.String({ maxLength: 36 })) })),
      detail: { tags: ["family"], summary: "Leave a family" },
    }
  )

  // ── DELETE remove a family member (admin only) ────────────────────────────────
  .delete(
    "/:familyId/members/:memberId",
    async ({ db, userId, params, set }) => {
      // Verify requester is admin
      const [myMembership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, params.familyId), eq(familyMembers.userId, userId)))
        .limit(1);

      if (myMembership?.role !== "admin") {
        set.status = 403;
        return { error: "Only admins can remove family members" };
      }

      // Remove member
      await db
        .delete(familyMembers)
        .where(
          and(eq(familyMembers.familyId, params.familyId), eq(familyMembers.userId, params.memberId))
        );

      // Clear member's familyId and atomically reset cached role to "member"
      // using Postgres JSONB operator to avoid a SELECT-then-UPDATE race condition.
      await db.update(users).set({
        familyId: null,
        updatedAt: new Date(),
        preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || '{"role":"member"}'::jsonb`,
      }).where(eq(users.id, params.memberId));

      // Invalidate all active sessions for the removed user so their existing
      // tokens can no longer access this family's data.
      // Better-auth stores sessions in the "session" table with a "user_id" column.
      // We delete directly via Drizzle sql`` since Better-auth's internal adapter
      // method is not exposed on auth.api for server-side use without the admin plugin.
      try {
        await db.execute(sql`DELETE FROM "session" WHERE "user_id" = ${params.memberId}`);
      } catch (sessionErr: unknown) {
        // Log but do not fail the removal — the member has been removed from the
        // family even if session cleanup encounters a transient DB error.
        logger.error(
          { err: sessionErr },
          "[family/remove] Failed to invalidate sessions for removed user"
        );
      }

      return { ok: true };
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }), memberId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Remove a family member (admin only)" },
    }
  )

  // ── POST create invitation code ───────────────────────────────────────────────
  .post(
    "/invitations",
    async ({ db, userId, body, set }) => {
      // Verify requesting user is a member of the family
      const [membership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, body.familyId), eq(familyMembers.userId, userId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this family" };
      }

      // Fetch inviter name and family name for the email (parallel, non-blocking on failure)
      const [[inviterUser], [family]] = await Promise.all([
        db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
        db.select({ name: families.name }).from(families).where(eq(families.id, body.familyId)).limit(1),
      ]);

      // Generate a unique 6-digit code (retry on collision)
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        // crypto.randomInt(min, max) is cryptographically secure (unlike Math.random())
        // Family invite codes must be unpredictable to prevent enumeration attacks
        code = crypto.randomInt(100_000, 1_000_000).toString();
        const [existing] = await db
          .select({ id: familyInvitations.id })
          .from(familyInvitations)
          .where(eq(familyInvitations.inviteCode, code))
          .limit(1);
        if (!existing) break;
        if (attempt === 4) {
          set.status = 500;
          return { error: "Could not generate a unique invitation code" };
        }
      }

      const invitationId = crypto.randomUUID();
      await db.insert(familyInvitations).values({
        id: invitationId,
        familyId: body.familyId,
        invitedBy: userId,
        inviteCode: code,
        email: body.email ?? null,
        invitedUserName: body.invitedUserName,
        invitedUserRelation: body.invitedUserRelation,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Send email to invitee — fire-and-forget so a SendGrid failure never
      // blocks the caller from receiving the invite code.
      if (body.email) {
        const inviterName = inviterUser?.name ?? "A Nuralix user";
        const familyName = family?.name ? `the ${family.name} family` : "a family";
        const appUrl = process.env.APP_URL ?? "https://app.nuralix.ai";

        const subject = `${inviterName} has invited you to join ${familyName} on Nuralix`;
        const bodyHtml = `
          <p>Hi ${body.invitedUserName},</p>
          <p><strong>${inviterName}</strong> has invited you to join ${familyName} on Nuralix as their <strong>${body.invitedUserRelation}</strong>.</p>
          <p>Nuralix is a family health platform that helps caregivers and family members stay informed and support each other's health.</p>
          <p>To accept this invitation, open the Nuralix app and enter the following code:</p>
          <h2 style="letter-spacing: 4px; font-size: 36px;">${code}</h2>
          <p>Or tap this link: <a href="${appUrl}/join?code=${code}">${appUrl}/join?code=${code}</a></p>
          <p><em>This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</em></p>
          <p>— The Nuralix team</p>
        `.trim();

        const sendgridApiKey = process.env.SENDGRID_API_KEY ?? "";
        const fromEmail = process.env.FROM_EMAIL ?? "noreply@nuralix.ai";

        if (sendgridApiKey) {
          fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sendgridApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: body.email }] }],
              from: { email: fromEmail, name: "Nuralix" },
              subject,
              content: [{ type: "text/html", value: bodyHtml }],
            }),
            signal: AbortSignal.timeout(10_000),
          }).then(async (res) => {
            const sendgridOk = res.ok;
            // After SendGrid succeeds:
            if (sendgridOk) {
              await db
                .update(familyInvitations)
                .set({ emailSentAt: new Date() })
                .where(eq(familyInvitations.id, invitationId));
            }
          }).catch((err) =>
            logger.error({ err }, "[family/invite] SendGrid failed")
          );
        } else {
          logger.warn({ email: body.email }, "[family/invite] SENDGRID_API_KEY not set — invitation email skipped");
        }
      }

      return { code };
    },
    {
      body: t.Object({
        familyId: t.String({ maxLength: 36 }),
        email: t.Optional(t.String({ format: "email", maxLength: 254 })),
        invitedUserName: t.String({ maxLength: 255 }),
        invitedUserRelation: t.String({ maxLength: 100 }),
      }),
      detail: { tags: ["family"], summary: "Create a family invitation code" },
    }
  )

  // ── GET invitation by code ────────────────────────────────────────────────────
  .get(
    "/invitations/code/:code",
    async ({ db, params }) => {
      const [invitation] = await db
        .select()
        .from(familyInvitations)
        .where(eq(familyInvitations.inviteCode, params.code))
        .limit(1);

      return invitation ?? null;
    },
    {
      params: t.Object({ code: t.String({ pattern: "^\\d{6}$" }) }),
      detail: { tags: ["family"], summary: "Look up a family invitation by code" },
    }
  )

  // ── POST claim (use) an invitation code ──────────────────────────────────────
  .post(
    "/invitations/code/:code/use",
    async ({ db, userId, params }) => {
      const [invitation] = await db
        .select()
        .from(familyInvitations)
        .where(eq(familyInvitations.inviteCode, params.code))
        .limit(1);

      if (!invitation) {
        return { ok: false, message: "Invalid invitation code" };
      }

      if (invitation.status === "used") {
        return { ok: false, message: "This invitation code has already been used" };
      }

      const isExpired =
        invitation.status === "expired" ||
        (invitation.expiresAt !== null && invitation.expiresAt < new Date());

      if (isExpired) {
        if (invitation.status !== "expired") {
          await db
            .update(familyInvitations)
            .set({ status: "expired" })
            .where(eq(familyInvitations.id, invitation.id));
        }
        return { ok: false, message: "This invitation code has expired" };
      }

      await db
        .update(familyInvitations)
        .set({ status: "used", usedAt: new Date(), usedBy: userId })
        .where(eq(familyInvitations.id, invitation.id));

      return { ok: true, familyId: invitation.familyId, message: "Code accepted" };
    },
    {
      params: t.Object({ code: t.String({ pattern: "^\\d{6}$" }) }),
      detail: { tags: ["family"], summary: "Claim a family invitation code" },
    }
  )

  // ── GET pending invitations for a family ─────────────────────────────────────
  .get(
    "/:familyId/invitations",
    async ({ db, userId, params, set }) => {
      // Only family members may list their own family's pending invitations
      const [membership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, params.familyId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this family" };
      }

      const rows = await db
        .select()
        .from(familyInvitations)
        .where(
          and(
            eq(familyInvitations.familyId, params.familyId),
            eq(familyInvitations.status, "pending")
          )
        );
      return rows;
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Get pending invitations for a family" },
    }
  )

  // ── POST mark expired invitations ────────────────────────────────────────────
  // Scoped to families where the caller is an admin — prevents any authenticated
  // user from mass-expiring invitations across all families in the system.
  .post(
    "/invitations/cleanup",
    async ({ db, userId, set }) => {
      // Resolve the families where the caller holds the admin role
      const adminMemberships = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(
          and(eq(familyMembers.userId, userId), eq(familyMembers.role, "admin"))
        );

      if (adminMemberships.length === 0) {
        set.status = 403;
        return { error: "You must be a family admin to run invitation cleanup" };
      }

      const familyIds = adminMemberships.map((m) => m.familyId);

      // Only expire invitations belonging to families the caller administers
      await db
        .update(familyInvitations)
        .set({ status: "expired" })
        .where(
          and(
            eq(familyInvitations.status, "pending"),
            lt(familyInvitations.expiresAt, new Date()),
            inArray(familyInvitations.familyId, familyIds)
          )
        );
      return { ok: true };
    },
    { detail: { tags: ["family"], summary: "Mark expired invitations as expired (scoped to caller's admin families)" } }
  )

  // ── GET family by ID ──────────────────────────────────────────────────────────
  .get(
    "/:familyId",
    async ({ db, userId, params, set }) => {
      // Only family members may read their family's data
      const [membership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, params.familyId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this family" };
      }

      const [family] = await db
        .select()
        .from(families)
        .where(eq(families.id, params.familyId))
        .limit(1);

      if (!family) {
        set.status = 404;
        return { error: "Family not found" };
      }

      const members = await db
        .select({ userId: familyMembers.userId })
        .from(familyMembers)
        .where(eq(familyMembers.familyId, params.familyId));

      return {
        id: family.id,
        name: family.name,
        createdBy: family.createdBy,
        memberIds: members.map((m) => m.userId),
        status: "active",
        createdAt: family.createdAt,
      };
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Get family by ID" },
    }
  )

  // Caregiver notes for a family member
  .post(
    "/caregiver-notes",
    async ({ db, userId, body, set }) => {
      // Verify caller is in the same family as the target member
      const [targetMembership] = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, body.memberId))
        .limit(1);

      if (!targetMembership) {
        set.status = 403;
        return { error: "Target member is not part of any family" };
      }

      const [myMembership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, targetMembership.familyId)))
        .limit(1);

      if (!myMembership) {
        set.status = 403;
        return { error: "You are not in the same family as this member" };
      }

      const [note] = await db
        .insert(caregiverNotes)
        .values({
          memberId: body.memberId,
          caregiverId: userId,
          caregiverName: body.caregiverName,
          note: body.note,
          tags: body.tags ?? [],
        })
        .returning();
      return note;
    },
    {
      body: t.Object({
        memberId: t.String({ maxLength: 36 }),
        note: t.String({ minLength: 1, maxLength: 5000 }),
        caregiverName: t.Optional(t.String({ maxLength: 255 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
      }),
      detail: { tags: ["family"], summary: "Add a caregiver note" },
    }
  )

  .get(
    "/caregiver-notes",
    async ({ db, userId, query, set }) => {
      // Verify caller is in the same family as the target member
      const [targetMembership] = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, query.memberId))
        .limit(1);

      if (!targetMembership) {
        set.status = 403;
        return { error: "Target member is not part of any family" };
      }

      const [myMembership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, targetMembership.familyId)))
        .limit(1);

      if (!myMembership) {
        set.status = 403;
        return { error: "You are not in the same family as this member" };
      }

      return db
        .select()
        .from(caregiverNotes)
        .where(eq(caregiverNotes.memberId, query.memberId))
        .orderBy(caregiverNotes.createdAt)
        .limit(query.limit ?? 20);
    },
    {
      query: t.Object({
        memberId: t.String({ maxLength: 36 }),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
      detail: { tags: ["family"], summary: "Get caregiver notes for a member" },
    }
  )

  // Set sharing scope for a family member (admin only)
  .patch(
    "/:familyId/members/:memberId/scope",
    async ({ db, userId, params, body, set }) => {
      // Verify caller is admin of this family
      const [callerMembership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, params.familyId),
            eq(familyMembers.userId, userId)
          )
        )
        .limit(1);

      if (!callerMembership || callerMembership.role !== "admin") {
        set.status = 403;
        return { error: "Only family admins can change sharing scope" };
      }

      // Update scope for target member
      await db
        .update(familyMembers)
        .set({ sharingScope: body.scope })
        .where(
          and(
            eq(familyMembers.familyId, params.familyId),
            eq(familyMembers.userId, params.memberId)
          )
        );

      return { ok: true, scope: body.scope };
    },
    {
      params: t.Object({
        familyId: t.String({ minLength: 1, maxLength: 36 }),
        memberId: t.String({ minLength: 1, maxLength: 36 }),
      }),
      body: t.Object({
        scope: t.Array(
          t.String({ maxLength: 50 }),
          { minItems: 1, maxItems: 10 }
        ),
      }),
      detail: { tags: ["family"], summary: "Set sharing scope for a family member" },
    }
  )

  .delete(
    "/caregiver-notes/:noteId",
    async ({ db, userId, params, set }) => {
      // Fetch the note to verify ownership before deleting
      const [note] = await db
        .select({ caregiverId: caregiverNotes.caregiverId })
        .from(caregiverNotes)
        .where(eq(caregiverNotes.id, params.noteId))
        .limit(1);

      if (!note) {
        set.status = 404;
        return { error: "Note not found" };
      }

      if (note.caregiverId !== userId) {
        set.status = 403;
        return { error: "You can only delete your own caregiver notes" };
      }

      // Include caregiverId in WHERE to close the TOCTOU window between the
      // ownership check above and this mutation — prevents a race where another
      // request deletes the note and a new note with the same id is inserted.
      await db.delete(caregiverNotes).where(
        and(eq(caregiverNotes.id, params.noteId), eq(caregiverNotes.caregiverId, userId))
      );
      return { ok: true };
    },
    {
      params: t.Object({ noteId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["family"], summary: "Delete a caregiver note" },
    }
  );
