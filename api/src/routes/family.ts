import { Elysia, t } from "elysia";
import { and, eq, lt } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { families, familyMembers, familyInvitations, vhi, genetics, alerts, users, caregiverNotes } from "../db/schema";

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

      // Fetch VHI for each member to build caregiver dashboard
      const memberData = await Promise.all(
        members.map(async (member) => {
          const [memberVhi] = await db
            .select()
            .from(vhi)
            .where(eq(vhi.userId, member.userId))
            .limit(1);

          const recentAlerts = await db
            .select()
            .from(alerts)
            .where(and(eq(alerts.userId, member.userId), eq(alerts.isAcknowledged, false)))
            .limit(5);

          // Genetics — only return if familySharingConsent is true
          const [memberGenetics] = await db
            .select({
              prsScores: genetics.prsScores,
              pharmacogenomics: genetics.pharmacogenomics,
              twinRelevantConditions: genetics.twinRelevantConditions,
              familySharingConsent: genetics.familySharingConsent,
            })
            .from(genetics)
            .where(eq(genetics.userId, member.userId))
            .limit(1);

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
                    conditions: (memberGenetics.prsScores as Array<{condition: string; percentile: number; level: string}> | null)?.map(({ condition, percentile, level }) => ({
                      condition,
                      percentile,
                      level,
                    })) ?? [],
                    pharmacogenomicsAlerts: memberGenetics.pharmacogenomics as Array<{drug: string; interaction: string}> | null ?? [],
                  }
                : null,
          };
        })
      );

      return memberData;
    },
    {
      params: t.Object({ familyId: t.String() }),
      detail: { tags: ["family"], summary: "Caregiver dashboard — all family members with VHI" },
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
      params: t.Object({ alertId: t.String() }),
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

      // Join with users table for full profile
      const userRows = await Promise.all(
        members.map(async (member) => {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, member.userId))
            .limit(1);
          if (!user) return null;

          const prefs = (user.preferences ?? {}) as Record<string, unknown>;
          const name = user.name ?? "";
          const nameParts = name.split(" ");

          return {
            id: user.id,
            email: user.email,
            firstName: (prefs.firstName as string | undefined) ?? nameParts[0] ?? "User",
            lastName: (prefs.lastName as string | undefined) ?? nameParts.slice(1).join(" ") ?? "",
            gender: user.gender,
            dateOfBirth: user.dateOfBirth,
            bloodType: user.bloodType,
            familyId: user.familyId,
            avatarUrl: user.avatarUrl,
            avatarType: prefs.avatarType,
            role: member.role ?? (prefs.role as string | undefined) ?? "member",
            createdAt: user.createdAt,
            onboardingCompleted: (prefs.onboardingCompleted as boolean | undefined) ?? false,
            dashboardTourCompleted: (prefs.dashboardTourCompleted as boolean | undefined) ?? false,
            isPremium: (prefs.isPremium as boolean | undefined) ?? false,
            preferences: {
              language: (user.language ?? (prefs.language as string | undefined) ?? "en") as "en" | "ar",
              notifications: (prefs.notifications as boolean | undefined) ?? true,
              emergencyContacts: (prefs.emergencyContacts as unknown[]) ?? [],
              careTeam: (prefs.careTeam as unknown[]) ?? [],
            },
          };
        })
      );

      return userRows.filter(Boolean);
    },
    {
      params: t.Object({ familyId: t.String() }),
      query: t.Object({ role: t.Optional(t.String()) }),
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

      // Also store role in preferences
      const [current] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
      const prefs = ((current?.preferences ?? {}) as Record<string, unknown>);
      await db.update(users).set({ preferences: { ...prefs, role: "admin" } }).where(eq(users.id, userId));

      return { id: familyId, name: body.name ?? "My Family" };
    },
    {
      body: t.Object({ name: t.Optional(t.String()) }),
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

      // Store role in preferences
      const [current] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, targetUserId)).limit(1);
      const prefs = ((current?.preferences ?? {}) as Record<string, unknown>);
      await db.update(users).set({ preferences: { ...prefs, role } }).where(eq(users.id, targetUserId));

      return { ok: true, familyId, role };
    },
    {
      params: t.Object({ familyId: t.String() }),
      body: t.Optional(t.Object({ userId: t.Optional(t.String()) })),
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
      params: t.Object({ familyId: t.String() }),
      body: t.Optional(t.Object({ userId: t.Optional(t.String()) })),
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

      // Clear member's familyId and reset cached role to "member"
      const [current] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, params.memberId)).limit(1);
      const prefs = ((current?.preferences ?? {}) as Record<string, unknown>);
      await db.update(users).set({
        familyId: null,
        updatedAt: new Date(),
        preferences: { ...prefs, role: "member" },
      }).where(eq(users.id, params.memberId));

      return { ok: true };
    },
    {
      params: t.Object({ familyId: t.String(), memberId: t.String() }),
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

      // Generate a unique 6-digit code (retry on collision)
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        code = Math.floor(100_000 + Math.random() * 900_000).toString();
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

      await db.insert(familyInvitations).values({
        id: crypto.randomUUID(),
        familyId: body.familyId,
        invitedBy: userId,
        inviteCode: code,
        invitedUserName: body.invitedUserName,
        invitedUserRelation: body.invitedUserRelation,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return { code };
    },
    {
      body: t.Object({
        familyId: t.String(),
        invitedUserName: t.String(),
        invitedUserRelation: t.String(),
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
      params: t.Object({ code: t.String() }),
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
      params: t.Object({ code: t.String() }),
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
      params: t.Object({ familyId: t.String() }),
      detail: { tags: ["family"], summary: "Get pending invitations for a family" },
    }
  )

  // ── POST mark expired invitations ────────────────────────────────────────────
  .post(
    "/invitations/cleanup",
    async ({ db }) => {
      await db
        .update(familyInvitations)
        .set({ status: "expired" })
        .where(
          and(
            eq(familyInvitations.status, "pending"),
            lt(familyInvitations.expiresAt, new Date())
          )
        );
      return { ok: true };
    },
    { detail: { tags: ["family"], summary: "Mark expired invitations as expired" } }
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
      params: t.Object({ familyId: t.String() }),
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
        memberId: t.String(),
        note: t.String(),
        caregiverName: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
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
        .limit(query.limit ? Number(query.limit) : 20);
    },
    {
      query: t.Object({
        memberId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: { tags: ["family"], summary: "Get caregiver notes for a member" },
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

      await db.delete(caregiverNotes).where(eq(caregiverNotes.id, params.noteId));
    },
    { detail: { tags: ["family"], summary: "Delete a caregiver note" } }
  );
