# Maak Health - Technology Stack

## Programming Languages & Frameworks

### Primary Technologies
- **TypeScript**: Primary language for type-safe development
- **React Native**: Cross-platform mobile app framework
- **Expo**: Development platform and build system (SDK 54)
- **React**: UI library (v19.1.0)
- **Node.js**: Backend runtime for cloud functions

### Native Development
- **Kotlin**: Android native module development
- **Swift/Objective-C**: iOS native integrations
- **Java**: Android Health Connect implementation

## Core Dependencies & Versions

### Mobile Framework
```json
"expo": "~54.0.30"
"react": "19.1.0"
"react-native": "0.76.5"
"expo-router": "~6.0.21"
```

### Health & Sensors
```json
"@kingstinct/react-native-healthkit": "^13.0.2"
"expo-sensors": "~15.0.8"
"expo-camera": "~17.0.10"
"react-native-vision-camera": "^4.7.3"
```

### Backend & Database
```json
"firebase": "^10.14.1"
"react-firebase-hooks": "^5.1.1"
```

### UI & Animation
```json
"react-native-reanimated": "~3.10.1"
"react-native-gesture-handler": "~2.28.0"
"expo-linear-gradient": "~15.0.8"
"lucide-react-native": "^0.400.0"
```

### Monetization & Analytics
```json
"react-native-purchases": "^9.6.12"
"react-native-purchases-ui": "^9.6.12"
```

## Build System & Development Tools

### Build Configuration
- **EAS Build**: Expo Application Services for cloud builds
- **Metro**: JavaScript bundler with custom configuration
- **Hermes**: JavaScript engine for both iOS and Android
- **TypeScript**: Strict type checking enabled

### Development Scripts
```bash
# Development
npm run dev                    # Start development server
npm run dev:tunnel            # Start with tunnel for device testing
npm run dev:clear             # Clear cache and start

# Building
npm run build:ios:dev         # iOS development build
npm run build:ios:preview     # iOS preview build
npm run build:ios:production  # iOS production build

# Firebase
npm run firebase:init         # Initialize Firebase collections
npm run firebase:check        # Validate Firebase setup
npm run validate:env          # Validate environment variables
```

### Code Quality Tools
- **Biome**: Fast linter and formatter (v2.3.10)
- **TypeScript**: Static type checking
- **Patch Package**: Dependency patching system
- **ESLint**: Code quality enforcement

## Platform-Specific Configuration

### iOS Configuration
- **Bundle ID**: com.maak.health
- **Build Number**: 27
- **HealthKit**: Full health data access permissions
- **Camera**: PPG heart rate measurement
- **Motion**: Fall detection capabilities
- **Biometric**: Face ID/Touch ID authentication

### Android Configuration
- **Package**: com.maak.health
- **Version Code**: 1
- **Health Connect**: Comprehensive health permissions
- **Camera**: Vital signs monitoring
- **Location**: Emergency alert functionality
- **Biometric**: Fingerprint authentication

## Environment & Configuration

### Required Environment Variables
```bash
# API Keys
OPENAI_API_KEY=                # AI assistant functionality
FITBIT_CLIENT_ID=             # Fitbit integration
FITBIT_CLIENT_SECRET=         # Fitbit authentication

# Firebase Configuration (auto-loaded from config files)
# GoogleService-Info.plist (iOS)
# google-services.json (Android)
```

### Firebase Services
- **Firestore**: Real-time database for health data
- **Authentication**: User management and security
- **Cloud Functions**: Server-side business logic
- **Cloud Messaging**: Push notifications
- **Storage**: File and image storage

## Development Commands

### Local Development
```bash
# Start development server
npm run dev

# iOS development build
npm run build:ios:dev

# Android development
npm run android

# Environment validation
npm run validate:env
```

### Database Management
```bash
# Initialize Firebase collections
npm run firebase:init

# Create user collections
npm run firebase:create-collections

# Fix medication data
npm run firebase:fix-medications
```

### Testing & Validation
```bash
# Test PPG functionality
npm run test:ppg

# Validate Firebase setup
npm run firebase:check

# Check build configuration
npm run build:list
```

## Architecture Decisions

### Performance Optimizations
- **Hermes Engine**: Faster JavaScript execution
- **Reanimated**: 60fps animations on UI thread
- **Vision Camera**: Hardware-accelerated camera processing
- **Nitro Modules**: High-performance native modules

### Security Implementations
- **Biometric Authentication**: Platform-native security
- **Secure Storage**: Encrypted local data storage
- **Firebase Security Rules**: Server-side access control
- **HTTPS**: All network communications encrypted