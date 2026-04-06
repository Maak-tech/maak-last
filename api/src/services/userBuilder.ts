import type { InferSelectModel } from 'drizzle-orm'
import type { users, familyMembers } from '../db/schema.js'

type UserRow = InferSelectModel<typeof users>
type MemberRow = Pick<InferSelectModel<typeof familyMembers>, 'role' | 'sharingScope'>

interface BuildUserObjectOptions {
  userRow: UserRow
  memberRow?: MemberRow | null
}

/**
 * Single source of truth for converting a DB user row into the API response shape.
 * Used by /api/users/:userId, PATCH /api/users/:userId, and /:familyId/users endpoints.
 *
 * `memberRow.role` takes precedence over the role stored in preferences, because
 * the familyMembers table is the authoritative source for family-scoped roles.
 */
export function buildUserObject({ userRow, memberRow }: BuildUserObjectOptions) {
  const prefs = (userRow.preferences ?? {}) as Record<string, unknown>
  const name = userRow.name ?? ''
  const nameParts = name.split(' ')

  return {
    id: userRow.id,
    email: userRow.email,
    firstName: (prefs.firstName as string | undefined) ?? nameParts[0] ?? 'User',
    lastName: (prefs.lastName as string | undefined) ?? nameParts.slice(1).join(' ') ?? '',
    gender: userRow.gender,
    dateOfBirth: userRow.dateOfBirth,
    bloodType: userRow.bloodType,
    familyId: userRow.familyId,
    avatarUrl: userRow.avatarUrl,
    avatarType: prefs.avatarType,
    role: memberRow?.role ?? (prefs.role as string | undefined) ?? 'member',
    createdAt: userRow.createdAt,
    onboardingCompleted: (prefs.onboardingCompleted as boolean | undefined) ?? false,
    dashboardTourCompleted: (prefs.dashboardTourCompleted as boolean | undefined) ?? false,
    isPremium: (prefs.isPremium as boolean | undefined) ?? false,
    preferences: {
      language: (userRow.language ?? (prefs.language as string | undefined) ?? 'en') as 'en' | 'ar',
      notifications: (prefs.notifications as boolean | undefined) ?? true,
      emergencyContacts: (prefs.emergencyContacts as unknown[]) ?? [],
      careTeam: (prefs.careTeam as unknown[]) ?? [],
    },
  }
}
