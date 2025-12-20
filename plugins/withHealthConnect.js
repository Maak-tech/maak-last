/**
 * Expo Config Plugin for Health Connect SDK
 * Adds Health Connect SDK dependency to Android build
 */

const { withAndroidManifest, withAppBuildGradle, withSettingsGradle } = require("expo/config-plugins");
const path = require("path");

/**
 * Add Health Connect SDK dependency to build.gradle
 */
const withHealthConnectSDK = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      // Find dependencies block and add Health Connect SDK
      const dependenciesMatch = config.modResults.contents.match(
        /dependencies\s*\{([^}]*)\}/
      );

      if (dependenciesMatch) {
        const dependenciesContent = dependenciesMatch[1];
        
        // Check if Health Connect SDK is already added
        if (!dependenciesContent.includes("androidx.health.connect:connect-client")) {
          // Add Health Connect SDK dependency
          config.modResults.contents = config.modResults.contents.replace(
            /(dependencies\s*\{)/,
            `$1
    // Health Connect SDK
    implementation "androidx.health.connect:connect-client:1.2.0-alpha02"`
          );
        }
      } else {
        // If dependencies block doesn't exist, add it
        config.modResults.contents += `
dependencies {
    // Health Connect SDK
    implementation "androidx.health.connect:connect-client:1.2.0-alpha02"
}
`;
      }
    }
    return config;
  });
};

/**
 * Add Health Connect permissions to AndroidManifest.xml
 */
const withHealthConnectPermissions = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    if (!manifest.usesPermission) {
      manifest.usesPermission = [];
    }

    // Add Health Connect permissions if not already present
    const permissions = [
      "android.permission.health.READ_HEALTH_DATA",
      "android.permission.health.WRITE_HEALTH_DATA",
    ];

    permissions.forEach((permission) => {
      const existingPermission = manifest.usesPermission.find(
        (p) => p.$["android:name"] === permission
      );
      
      if (!existingPermission) {
        manifest.usesPermission.push({
          $: { "android:name": permission },
        });
      }
    });

    return config;
  });
};

/**
 * Add Expo module to settings.gradle
 */
const withHealthConnectModule = (config) => {
  return withSettingsGradle(config, (config) => {
    const modulePath = path.resolve(__dirname, "../modules/expo-health-connect/android");
    const includeStatement = `include ':expo-health-connect'\nproject(':expo-health-connect').projectDir = new File('${modulePath.replace(/\\/g, '/')}')`;
    
    if (!config.modResults.contents.includes(":expo-health-connect")) {
      config.modResults.contents += `\n${includeStatement}\n`;
    }
    
    return config;
  });
};

/**
 * Main plugin function
 */
const withHealthConnect = (config) => {
  config = withHealthConnectSDK(config);
  config = withHealthConnectPermissions(config);
  config = withHealthConnectModule(config);
  return config;
};

module.exports = withHealthConnect;

