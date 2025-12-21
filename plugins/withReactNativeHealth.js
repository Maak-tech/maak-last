const { withDangerousMod, withPlugins } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin for react-native-health
 * Adds the RNHealth pod to Podfile and ensures proper linking
 */
const withReactNativeHealth = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      
      if (!fs.existsSync(podfilePath)) {
        console.log("Podfile not found, skipping react-native-health plugin");
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Check if RNHealth is already added
      if (podfileContent.includes("pod 'react-native-health'")) {
        console.log("react-native-health pod already in Podfile");
        return config;
      }

      // Find the target section - typically looks like: target 'ProjectName' do
      const targetRegex = /(target\s+['"][^'"]+['"]\s+do)/;
      const targetMatch = podfileContent.match(targetRegex);

      if (targetMatch) {
        // Add the react-native-health pod after the target declaration
        const healthPod = `
  # react-native-health pod
  pod 'react-native-health', :path => '../node_modules/react-native-health'
`;
        
        podfileContent = podfileContent.replace(
          targetMatch[0],
          `${targetMatch[0]}${healthPod}`
        );

        fs.writeFileSync(podfilePath, podfileContent);
        console.log("Added react-native-health pod to Podfile");
      } else {
        console.warn("Could not find target in Podfile for react-native-health");
      }

      return config;
    },
  ]);
};

module.exports = withReactNativeHealth;

