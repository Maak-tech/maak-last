# Maak Health

Expo (Expo Router) app with Firebase + EAS build profiles.

## Setup

```bash
npm install
cp .env.example .env
```

## Quality checks (recommended before release)

```bash
npm run typecheck
npm run lint -- --diagnostic-level=error
npm run validate:production
```

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

