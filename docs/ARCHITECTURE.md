# Nuralix Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────┐
│                  Mobile App (Expo)                   │
│  iOS / Android                                       │
│  - React Native + Expo Router                        │
│  - SecureStore for emergency cache                   │
│  - AsyncStorage for offline queue                    │
│  - expo-background-fetch for sync                    │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS + Cookie Auth
┌────────────────────▼────────────────────────────────┐
│              API Server (Elysia on Bun)              │
│  Railway (auto-scaling, multi-instance)              │
│                                                      │
│  Routes: /api/v1/health  /api/v1/nora                │
│          /api/v1/family  /api/v1/user                │
│          /api/v1/genetics  /api/v1/emergency         │
│                                                      │
│  Middleware: auth · rate-limit · audit-log · CORS    │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
┌──────────▼──────┐        ┌──────────▼──────────────┐
│  Neon PostgreSQL│        │   Background Workers     │
│  (primary store)│        │   (Railway Cron)         │
│  TLS + AES-256 │        │                          │
│  at rest        │        │  • VHI Cycle (15 min)    │
└─────────────────┘        │  • Escalation (5 min)    │
                           │  • Caregiver Digest (1d) │
┌─────────────────┐        │  • PHI Retention (1d)    │
│  Redis (opt.)   │        │  • DNA Parser (queue)    │
│  Rate limiting  │        └──────────────────────────┘
│  (if REDIS_URL) │
└─────────────────┘        External Services:
                           • OpenAI (Nora AI)
┌─────────────────┐        • Twilio (emergency SMS)
│  Tigris (S3)    │        • Expo Push (notifications)
│  Genetic files  │        • Sentry (error tracking)
│  Health exports │
└─────────────────┘

Hospital Dashboard (Next.js)
  ├── Facial recognition patient lookup
  ├── Three-tier access ladder (preview→DOB→full)
  ├── HIPAA audit trail
  └── Staff session management
```
