# Maak Health App

## Overview
Maak Health is a React Native/Expo mobile health application that provides personalized health insights, vital signs monitoring, medication management, and an AI health assistant (Zeina).

## Project Structure
- `app/` - Expo Router screens and navigation
- `components/` - Reusable React Native components
- `lib/` - Core services and utilities (Firebase, health sync, etc.)
- `contexts/` - React Context providers
- `hooks/` - Custom React hooks
- `assets/` - Images, fonts, and documentation
- `functions/` - Firebase Cloud Functions
- `scripts/` - Build and utility scripts
- `docs/` - Technical documentation

## Tech Stack
- **Framework**: Expo SDK 54 with React Native 0.81
- **Navigation**: Expo Router
- **State Management**: React Context + hooks
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **Payments**: RevenueCat
- **AI**: OpenAI API (for Zeina assistant)
- **Health Integrations**: HealthKit (iOS), Fitbit, Dexcom, and other health providers

## Development Setup
This project is configured to run the Expo development server with tunnel mode, allowing you to connect from a dev build on your physical device.

### Running the App
1. The Expo dev server starts automatically with tunnel mode
2. Scan the QR code from the console output using your dev build app
3. The app will connect via the ngrok tunnel

### Environment Variables
The app uses environment variables for API keys and configuration. Key variables include:
- `OPENAI_API_KEY` - For Zeina AI assistant
- `REVENUECAT_API_KEY` - For in-app purchases
- Various health provider OAuth credentials

### Build Commands
- `bun run dev:tunnel` - Start dev server with tunnel
- `bun run build:web` - Export for web
- `bun run build:ios:dev` - Build iOS development client
- `bun run build:android:dev` - Build Android development client

## Package Manager
This project uses **bun** as the package manager. Use `bun install` for dependencies.

## Observability Infrastructure

The app includes a comprehensive observability system in `lib/observability/`:

- **Event Emitter** (`eventEmitter.ts`): Buffered event logging with PHI redaction, app lifecycle handling
- **Rules Engine** (`rulesEngine.ts`): Patient health threshold and trend detection for vitals
- **Escalation Service** (`escalationService.ts`): Alert escalation workflow with configurable policies
- **Circuit Breaker** (`circuitBreaker.ts`): Resilience pattern for external service calls
- **Health Timeline** (`healthTimeline.ts`): Family-level health events aggregation
- **Platform Instrumentation** (`platformInstrumentation.ts`): Pre-built instrumenters for API, sync, AI, auth, payment services

### Firestore Collections
- `observability_events` - All observability events
- `observability_metrics` - Platform metrics
- `alert_audits` - Alert lifecycle audit trail
- `health_timeline` - Family health timeline events
- `escalations` - Active alert escalations

## Recent Changes
- 2026-01-16: Fixed PPG Vitals Monitor to use real camera measurement
  - ppg-measure.tsx: Now loads PPGVitalMonitorVisionCamera for real camera PPG
  - PPGPixelExtractor.ts: Improved frame data extraction with multiple access methods
  - Uses back camera with torch/flash enabled for proper PPG illumination
  - Green banner shows "Real Camera PPG Measurement" when using actual camera
  - Falls back to simulated component only if VisionCamera fails to load
- 2026-01-16: Added Arabic localization to Zeina voice assistant responses
  - zeinaActionsService.ts: Vital names, vital advice, symptom advice fully localized
  - logSymptom and logVitalSign methods now accept isArabic parameter
  - Severity text, symptom-specific advice, and vital-specific insights in Arabic
  - healthContextService.ts updated to pass language parameter
- 2026-01-16: Fixed health suggestions navigation routes
  - View Vitals → /(tabs)/vitals, View Allergies → /(tabs)/allergies
  - View Alerts → /(tabs)/family, View Dashboard → /health-summary
- 2026-01-16: Added Arabic localization to health observability services
  - healthAnalytics.ts: Risk factors, recommendations, trends, vital names fully localized
  - rulesEngine.ts: Threshold messages, recommended actions, vital names fully localized
  - All analytics methods now accept optional isArabic parameter
- 2026-01-16: Integrated Health Companion observability with core health services
  - Vitals ingestion now triggers rules engine for automatic threshold/trend detection
  - Alert creation automatically starts escalation workflows and emits observability events
  - Health timeline receives events from vitals, medications, symptoms, and alerts
  - Caregiver notification flow with 3-level escalation (caregiver → secondary → emergency)
  - OpenAI service instrumented with latency tracking via aiInstrumenter
  - EmergencyAlert type extended to support vital_critical/vital_error types and metadata
- 2026-01-16: Fixed Arabic localization for health insights and summaries
  - Added Arabic translations to healthSummaryService.ts for insights, patterns, and recommendations
  - Updated health-summary.tsx to pass language preference to summary generation
  - Added Arabic support to getPersonalizedTips in proactiveHealthSuggestionsService.ts
- 2026-01-16: Added comprehensive observability infrastructure
  - Event emitter with PHI redaction and allowlist filtering
  - Health rules engine for vital threshold/trend detection
  - Alert escalation workflow with caregiver → secondary → emergency levels
  - Circuit breaker pattern for service resilience
  - Health timeline for family-level event aggregation
  - Platform instrumentation helpers with metrics and latency tracking
- 2026-01-16: Enhanced health suggestions to use user's trends, alerts, and events
  - Suggestions now consider logged alerts (especially unresolved high-priority ones)
  - Upcoming calendar events (appointments, medication schedules) trigger reminders
  - Vital sign trends analyzed over 30 days to detect significant changes
  - Allergy-aware suggestions warn about medication interactions
  - Medical history conditions inform personalized health advice
- 2026-01-16: Added allergy and medical history tracking to Zeina voice assistant
  - Zeina now automatically logs allergies when users mention them (e.g., "I'm allergic to penicillin")
  - Zeina tracks medical history conditions (e.g., "I have diabetes", "I had surgery last year")
  - Tool definitions added to realtimeAgentService.ts with smart type inference
  - Action implementations in zeinaActionsService.ts with natural language date parsing
- 2026-01-16: Configured Replit environment with tunnel mode for mobile development

## Health Companion Integration

The app implements a comprehensive Health Companion feature with two observability layers:

### Patient Health Observability
- **Vitals Ingestion**: When vitals are synced from HealthKit/wearables, they are evaluated by the rules engine
- **Rules Engine**: Detects threshold breaches (e.g., heart rate > 120bpm) and trends (e.g., rising blood pressure)
- **Automatic Alerts**: Creates EmergencyAlert records when thresholds are breached
- **Escalation Workflow**: Starts caregiver notifications with 3 escalation levels
- **Health Timeline**: All health events (vitals, symptoms, meds) logged for family view

### Advanced Health Analytics (`lib/observability/healthAnalytics.ts`)
- **Personalized Baselines**: Learn individual patient normal ranges from historical data (mean, std dev, percentiles)
- **Statistical Anomaly Detection**: Z-score based detection that adapts to personal baselines
- **Composite Health Score**: 0-100 score with cardiovascular, respiratory, metabolic, and activity components
- **Vital Correlations**: Detect relationships between different vital signs (e.g., sleep affects heart rate)
- **Predictive Risk Assessment**: Calculate risk scores based on anomalies and trends with recommendations
- **Alert Fatigue Prevention**: Smart throttling with cooldowns (30 min) and hourly limits (5 alerts/hour)

### Family Health Dashboard (`lib/observability/familyDashboard.ts`)
- **Family-level Overview**: Aggregate health status of all family members
- **Member Summaries**: Health score, risk level, active alerts, last vitals for each member
- **Alert History**: Track alerts over time with daily counts and severity
- **Health Score Trends**: Track health score improvement/decline over 30 days

### Services Integration
- `vitalSyncService.ts` → `rulesEngine` → `alertService` → `escalationService`
- `rulesEngine.ts` → `healthAnalytics` (personalized baseline evaluation, alert throttling)
- `medicationService.ts` → `healthTimeline` (medication taken/missed events)
- `symptomService.ts` → `healthTimeline` (symptom logged events)
- `alertService.ts` → `escalationService` + `healthTimeline` + `observabilityEmitter`

### Firestore Collections (Health Analytics)
- `patient_baselines` - Personalized vital thresholds per user/vital type
- `health_scores` - Historical health scores with component breakdown
- `risk_assessments` - Risk evaluations with factors and recommendations
