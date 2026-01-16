const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin to fix:
 * 1. Folly coroutines issue with react-native-reanimated
 * 2. Firebase Swift pods modular headers requirement
 */
const withFollyFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Remove global use_modular_headers! if present (we're using static frameworks instead)
      podfileContent = podfileContent.replace(/^\s*use_modular_headers!\s*$/gm, "");
      
      // expo-build-properties handles use_frameworks! :linkage => :static configuration
      // No need to add it here

      // Check if the folly fix is already applied
      if (podfileContent.includes("FOLLY_HAS_COROUTINES")) {
        fs.writeFileSync(podfilePath, podfileContent);
        return config;
      }

      // Find the post_install hook or create one
      // Use consistent regex pattern that matches both with and without newline before 'end'
      const postInstallRegex =
        /(post_install do \|installer\|)([\s\S]*?)(\n?end\b)/;
      const postInstallMatch = podfileContent.match(postInstallRegex);
      const hasPostInstall = postInstallMatch !== null;

      const follyFix = `
  # Fix for react-native-reanimated folly coroutines issue
  system("chmod -R u+w Pods/RCT-Folly")
  Dir.glob("Pods/RCT-Folly/folly/Portability.h").each do |file|
    text = File.read(file)
    new_contents = text.gsub('#define FOLLY_HAS_COROUTINES 1', '#define FOLLY_HAS_COROUTINES 0')
    File.open(file, "w") { |f| f.puts new_contents }
  end
  
`;

      if (hasPostInstall && postInstallMatch) {
        // Add to existing post_install hook
        // Ensure we preserve the original 'end' format (with or without newline)
        const endMarker = postInstallMatch[3]; // This preserves \nend or end
        podfileContent = podfileContent.replace(
          postInstallMatch[0],
          `${postInstallMatch[1]}${postInstallMatch[2]}${follyFix}${endMarker}`
        );
      } else {
        // Create new post_install hook - add before the final 'end' of the target block
        // Find the last occurrence of 'end' that's likely the end of the target block
        const lines = podfileContent.split("\n");
        let lastEndIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim() === "end") {
            lastEndIndex = i;
            break;
          }
        }
        if (lastEndIndex !== -1) {
          lines.splice(
            lastEndIndex,
            0,
            `post_install do |installer|${follyFix}end`
          );
          podfileContent = lines.join("\n");
        }
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withFollyFix;
