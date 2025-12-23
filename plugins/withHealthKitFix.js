/**
 * Custom Expo config plugin wrapper for react-native-health
 * This ensures the plugin runs correctly with Expo SDK 54
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withHealthKitFix = (config) => {
  // First, ensure the react-native-health plugin runs
  // We'll wrap it to add additional safety checks
  
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      
      if (!fs.existsSync(podfilePath)) {
        console.warn("[HealthKit Fix] Podfile not found, skipping pod linking fix");
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Ensure RNAppleHealthKit pod is explicitly included
      // Check if it's already there
      if (podfileContent.includes("RNAppleHealthKit") || podfileContent.includes("react-native-health")) {
        console.log("[HealthKit Fix] react-native-health pod already referenced");
        return config;
      }

      // Find the target block and add the pod
      // Look for the main app target
      const targetRegex = /target\s+['"]([^'"]+)['"]\s+do/;
      const targetMatch = podfileContent.match(targetRegex);
      
      if (targetMatch) {
        const targetName = targetMatch[1];
        const targetBlockRegex = new RegExp(`(target\\s+['"]${targetName}['"]\\s+do)([\\s\\S]*?)(\\n?end\\b)`, 'm');
        const targetBlockMatch = podfileContent.match(targetBlockRegex);
        
        if (targetBlockMatch) {
          // Always add explicit pod reference to ensure it's linked
          // Even if use_native_modules! is present, auto-linking might skip it
          const podLine = `  pod 'RNAppleHealthKit', :path => '../node_modules/react-native-health'\n`;
          const endMarker = targetBlockMatch[3];
          
          // Check if pod is already there
          if (!targetBlockMatch[2].includes("RNAppleHealthKit")) {
            podfileContent = podfileContent.replace(
              targetBlockMatch[0],
              `${targetBlockMatch[1]}${targetBlockMatch[2]}${podLine}${endMarker}`
            );
            console.log("[HealthKit Fix] Added explicit RNAppleHealthKit pod reference to ensure linking");
          } else {
            console.log("[HealthKit Fix] RNAppleHealthKit pod already present");
          }
        }
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withHealthKitFix;

