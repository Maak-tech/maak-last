# Tech Debt: Inline RTL / Language Ternaries

Files that contain inline `isRTL ? '...' : '...'`, `language === 'ar' ? '...' : '...'`,
or `i18n.locale === 'ar' ? '...' : '...'` patterns instead of `t()` key lookups.

These should be migrated to the i18n translation system (`en.json` / `ar.json`) so
strings are maintained in one place and additional languages can be added without
code changes.

## Migration Priority

| File | Inline Ternary Count | Priority |
|------|---------------------|----------|
| `app/(tabs)/family.tsx` | 189 | P0 |
| `app/family/[memberId].tsx` | 185 | P0 |
| `app/(tabs)/index.tsx` | 122 | P0 |
| `app/(tabs)/profile.tsx` | 108 | P0 |
| `app/(tabs)/symptoms.tsx` | 81 | P0 |
| `app/profile/personal-info.tsx` | 77 | P1 |
| `app/(tabs)/medications.tsx` | 76 | P1 |
| `app/profile/genetics.tsx` | 73 | P1 |
| `app/profile/help-support.tsx` | 65 | P1 |
| `app/profile/medical-history.tsx` | 63 | P1 |
| `app/(tabs)/blood-pressure.tsx` | 51 | P1 |
| `app/profile/notification-settings.tsx` | 49 | P1 |
| `app/(tabs)/vitals.tsx` | 49 | P1 |
| `app/(tabs)/track.tsx` | 49 | P1 |
| `app/profile/fall-detection.tsx` | 43 | P1 |
| `app/components/AlertsCard.tsx` | 43 | P1 |
| `app/profile/health/fitbit-intro.tsx` | 37 | P2 |
| `app/(settings)/health/apple/index.tsx` | 35 | P2 |
| `app/(auth)/register.tsx` | 35 | P2 |
| `app/profile/terms-conditions.tsx` | 33 | P2 |
| `app/(settings)/health/healthconnect/index.tsx` | 32 | P2 |
| `app/(tabs)/resources.tsx` | 31 | P2 |
| `app/(tabs)/lab-results.tsx` | 31 | P2 |
| `app/(tabs)/calendar.tsx` | 31 | P2 |
| `app/(tabs)/allergies.tsx` | 30 | P2 |
| `app/profile/health-integrations.tsx` | 29 | P2 |
| `app/(settings)/premium.tsx` | 29 | P2 |
| `app/(auth)/login.tsx` | 28 | P2 |
| `app/profile/admin-settings.tsx` | 23 | P2 |
| `app/health-summary.tsx` | 23 | P2 |
| `app/(tabs)/org-dashboard.tsx` | 23 | P2 |
| `app/profile/privacy-policy.tsx` | 21 | P2 |
| `app/onboarding.tsx` | 20 | P2 |
| `app/(settings)/health/healthconnect/permissions.tsx` | 19 | P3 |
| `app/(settings)/create-org.tsx` | 19 | P3 |
| `app/(tabs)/nora.tsx` | 18 | P3 |
| `app/(tabs)/analytics.tsx` | 18 | P3 |
| `app/(settings)/health/apple/permissions.tsx` | 18 | P3 |
| `app/profile/health-insights.tsx` | 15 | P3 |
| `app/(settings)/org/api-keys.tsx` | 15 | P3 |
| `app/(settings)/org/webhooks.tsx` | 14 | P3 |
| `app/components/FamilyDataFilter.tsx` | 13 | P3 |
| `app/(tabs)/timeline.tsx` | 13 | P3 |
| `app/(tabs)/discoveries.tsx` | 12 | P3 |
| `app/components/GlobalSearch.tsx` | 10 | P3 |
| `app/(settings)/org/audit-trail.tsx` | 3 | P4 |
| `app/(settings)/org/templates.tsx` | 2 | P4 |
| `app/(settings)/org/patient-detail.tsx` | 2 | P4 |
| `app/(settings)/org/notifications.tsx` | 2 | P4 |
| `app/(settings)/org/members.tsx` | 2 | P4 |
| `app/(settings)/org/fhir.tsx` | 2 | P4 |
| `app/(settings)/org/billing.tsx` | 2 | P4 |
| `app/(settings)/my-consents.tsx` | 2 | P4 |

**Total: 1,058 inline ternaries across 53 files**

## What Was Done (April 2026)

- Added `// TODO(i18n): X inline RTL/language ternaries` comment to the top 5 most affected files
- Added 20 missing i18n keys to `locales/en.json` and `locales/ar.json`:
  - `share`, `pleaseEnterName`, `noFamilyFound`, `joinAFamily`, `emergencySettings`
  - `copied`, `emergencyContacts`, `inviteCode`, `sendInvitation`, `reminderTimes`
  - `failedToLoadData`, `excellent`, `good`, `needsAttention`, `critical`
  - `notifyFamily`, `familyData`, `callEmergency`, `emergency`, `noFamilyJoined`
  - `inviteNewMemberTitle`, `shareInviteCode`, `joinFamily`, `medicationNamePlaceholder`
  - `addMedicationFor`, `addTime`, `enterSymptomTypePlaceholder`, `notificationSentTitle`
  - `failedToSendNotificationShort`, `failedToUpdateProfile`, `profileUpdated`

## Migration Approach

1. Replace `isRTL ? 'ar-text' : 'en-text'` with `t('keyName')`
2. Add both `"keyName": "en-text"` to `locales/en.json` and `"keyName": "ar-text"` to `locales/ar.json`
3. For layout direction ternaries (`isRTL ? 'right' : 'left'`), use `I18nManager.isRTL` directly in styles or a shared `dir` constant
4. Test both `ar` and `en` locales after each file migration

## Pattern Detection

To find remaining inline ternaries:
```bash
grep -rn "isRTL ? \|language === 'ar'\|i18n.locale === 'ar'" app/ --include="*.tsx" | wc -l
```
