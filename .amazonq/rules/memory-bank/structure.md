# Maak Health - Project Structure

## Directory Organization

### Core Application Structure
```
app/                    # Expo Router-based navigation and screens
├── (auth)/            # Authentication flow (login, register)
├── (tabs)/            # Main tab navigation screens
├── (settings)/        # Settings and configuration screens
├── components/        # Screen-specific components
├── family/           # Family member management
└── profile/          # User profile and preferences
```

### Key Components & Libraries
```
components/           # Reusable UI components
├── AdaptiveBiometricAuth.js    # Biometric authentication
├── PPGVitalMonitor.tsx         # Heart rate monitoring
├── RevenueCatPaywall.tsx       # Subscription management
└── ReadyPlayerMeAvatar.tsx     # 3D avatar integration
```

### Business Logic & Services
```
lib/                  # Core business logic and utilities
├── services/         # External service integrations
│   ├── appleHealthService.ts   # HealthKit integration
│   ├── healthConnectService.ts # Google Health Connect
│   ├── openaiService.ts        # AI assistant backend
│   ├── fcmService.ts          # Push notifications
│   └── revenueCatService.ts   # Subscription management
├── health/           # Health data types and sync
├── utils/            # Utility functions and helpers
└── firebase.ts       # Firebase configuration
```

### State Management & Context
```
contexts/             # React Context providers
├── AuthContext.tsx           # User authentication state
├── FallDetectionContext.tsx  # Fall detection monitoring
└── ThemeContext.tsx         # UI theme management
```

### Custom Modules & Extensions
```
modules/              # Custom native modules
└── expo-health-connect/     # Android Health Connect integration
    ├── android/            # Native Android implementation
    └── ExpoHealthConnectModule.ts
```

### Backend & Cloud Functions
```
functions/            # Firebase Cloud Functions
├── src/             # TypeScript source code
├── orpc/            # API routing and types
└── lib/             # Compiled JavaScript output
```

### Development & Build Tools
```
scripts/             # Development automation scripts
├── build-ios-dev.sh        # iOS development builds
├── firebase-init-collections.ts  # Database setup
└── validate-env.ts         # Environment validation
```

## Architectural Patterns

### Navigation Architecture
- **Expo Router**: File-based routing with TypeScript support
- **Tab Navigation**: Main app sections (Health, Family, AI Assistant)
- **Stack Navigation**: Hierarchical screen navigation
- **Modal Presentation**: Settings and detailed views

### Data Flow Architecture
- **Firebase Firestore**: Real-time database for health data
- **React Context**: Global state management for auth and settings
- **Custom Hooks**: Reusable business logic (useFallDetection, useRevenueCat)
- **Service Layer**: Abstracted external API integrations

### Health Data Integration
- **Apple HealthKit**: iOS native health data access
- **Google Health Connect**: Android health platform integration
- **Custom PPG Module**: Camera-based vital sign measurement
- **Real-time Sync**: Bidirectional health data synchronization

### Security & Privacy
- **Biometric Authentication**: Face ID/Touch ID integration
- **Secure Storage**: Expo SecureStore for sensitive data
- **Firebase Security Rules**: Server-side data protection
- **HIPAA Considerations**: Health data privacy compliance

### Monetization Architecture
- **RevenueCat**: Cross-platform subscription management
- **Feature Gating**: Premium feature access control
- **Tiered AI Services**: Basic vs premium AI assistant capabilities
- **Family Sharing**: Premium subscription benefits

## Core Relationships

### Health Data Flow
1. **Collection**: Native health platforms → Custom services
2. **Processing**: Health services → Firebase Firestore
3. **Analysis**: AI services → Health insights
4. **Presentation**: React components → User interface

### User Experience Flow
1. **Authentication**: Biometric → Firebase Auth
2. **Onboarding**: Health permissions → Data sync
3. **Monitoring**: Continuous tracking → Real-time updates
4. **Insights**: AI analysis → Personalized recommendations
5. **Family Sharing**: Data permissions → Collaborative care