# Maak Health

Expo (Expo Router) app with Firebase + EAS build profiles.

## Setup

```bash
npm install
cp .env.example .env
```

## OpenAI (server-side)

- OpenAI API keys are not bundled into the app. Set `OPENAI_API_KEY` / `ZEINA_API_KEY` as Firebase Functions secrets and deploy functions.
- AI is gated to active Family Plan subscribers; set Firebase Functions secret `REVENUECAT_SECRET_API_KEY` so the backend can verify entitlements.

## Quality checks (recommended before release)

```bash
npm run typecheck
npm run lint -- --diagnostic-level=error
npm run validate:production
```

## Performance knobs

- iOS JS engine defaults to Hermes; override with `EXPO_PUBLIC_IOS_JS_ENGINE=jsc` (requires rebuild).
- Sentry performance defaults: `tracesSampleRate` is `1.0` in dev and `0.1` in production; override with `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
- To enable Sentry Session Replay, set `EXPO_PUBLIC_SENTRY_ENABLE_REPLAY=true` and optionally tune:
  - `EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`
  - `EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`

## Web export

```bash
npm run build:web
```

## Mobile builds (EAS)

```bash
npm run build:ios:production
npm run build:android:production
```

For Firebase helper scripts, see `scripts/README.md`.

