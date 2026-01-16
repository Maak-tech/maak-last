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

## Recent Changes
- 2026-01-16: Configured Replit environment with tunnel mode for mobile development
