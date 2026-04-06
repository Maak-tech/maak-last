# HIPAA Business Associate Agreement (BAA) Checklist

Last updated: 2026-04-06
Maintained by: Engineering Lead / DPO

## Overview

Nuralix processes Protected Health Information (ePHI) and shares it with third-party
services. Each service that may receive ePHI must have a signed BAA in place before
go-live in production.

## Third-Party Services with PHI Exposure

| Service | Data Sent | BAA Required | BAA Signed | Notes |
|---------|-----------|--------------|------------|-------|
| **Neon (PostgreSQL)** | All ePHI (primary store) | YES | [ ] | neon.tech/security |
| **OpenAI** | VHI context block, symptom summaries, transcriptions | YES | [ ] | enterprise.openai.com/baa |
| **Expo Push Service** | Notification titles (may contain health references) | YES | [ ] | expo.dev/privacy |
| **Twilio** | Emergency contact phone numbers, SMS content | YES | [ ] | twilio.com/legal/baa |
| **Sentry** | Error context (PHI stripped via beforeSend — verify annually) | YES | [ ] | sentry.io/legal/baa |
| **Railway** | Server environment, logs (ensure log retention policy) | YES | [ ] | railway.app/legal |
| **Tigris (S3)** | Genetic data files, health exports | YES | [ ] | tigrisdata.com |

## PHI Stripping Verification

The following services receive data that has been programmatically stripped of direct PHI
identifiers. Verify these annually:

- **Sentry**: `api/src/lib/sentry.ts` → `beforeSend()` strips name, dateOfBirth, phone, email,
  address, content, notes. Last verified: [ ]
- **Push notifications**: `api/src/lib/push.ts` → bodies use generic phrases only, no clinical values.
  Last verified: [ ]

## Encryption at Rest

| Store | Encryption | Method | Verified |
|-------|-----------|--------|---------|
| Neon PostgreSQL | Disk-level AES-256 | Neon managed | [ ] |
| Tigris S3 | AES-256-S3 | Tigris managed | [ ] |
| OAuth tokens in DB | AES-256-GCM | Application-level (`tokenEncryption.ts`) | [x] |
| Mobile SecureStore | iOS Keychain / Android Keystore | OS-managed | [x] |

## Action Items Before Go-Live

- [ ] Sign BAA with Neon
- [ ] Sign BAA with OpenAI (requires ChatGPT Enterprise or API Enterprise agreement)
- [ ] Sign BAA with Expo
- [ ] Sign BAA with Twilio
- [ ] Sign BAA with Sentry
- [ ] Sign BAA with Railway
- [ ] Sign BAA with Tigris
- [ ] Legal review of Sentry PHI stripping implementation
- [ ] Legal review of push notification content policy
- [ ] Document RTO/RPO targets
- [ ] Complete penetration test
- [ ] Complete HIPAA Security Risk Assessment (SRA)
