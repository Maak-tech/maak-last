/**
 * React Native Configuration
 * Forces react-native-health to be included in auto-linking
 * This ensures the module is linked even if auto-linking skips it
 */
module.exports = {
  dependencies: {
    'react-native-health': {
      platforms: {
        ios: {
          // Force inclusion in auto-linking
          sourceDir: '../node_modules/react-native-health',
          podspecPath: '../node_modules/react-native-health/RNAppleHealthKit.podspec',
          project: '../node_modules/react-native-health/RCTAppleHealthKit.xcodeproj',
        },
      },
    },
  },
  // Ensure react-native-health is not excluded from auto-linking
  project: {
    ios: {},
  },
};

