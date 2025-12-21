const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin to fix folly coroutines issue with react-native-reanimated
 * This disables FOLLY_HAS_COROUTINES in the Podfile post_install hook
 */
const withFollyFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      
      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Check if the fix is already applied
      if (podfileContent.includes("FOLLY_HAS_COROUTINES")) {
        return config;
      }

      // Find the post_install hook or create one
      const postInstallPattern = /post_install do \|installer\|([\s\S]*?)end/;
      const hasPostInstall = postInstallPattern.test(podfileContent);

      const follyFix = `
  # Fix for react-native-reanimated folly coroutines issue
  system("chmod -R u+w Pods/RCT-Folly")
  Dir.glob("Pods/RCT-Folly/folly/Portability.h").each do |file|
    text = File.read(file)
    new_contents = text.gsub('#define FOLLY_HAS_COROUTINES 1', '#define FOLLY_HAS_COROUTINES 0')
    File.open(file, "w") { |f| f.puts new_contents }
  end
`;

      if (hasPostInstall) {
        // Add to existing post_install hook - use non-greedy match to get the first matching end
        const postInstallMatch = podfileContent.match(/(post_install do \|installer\|)([\s\S]*?)(\nend)/);
        if (postInstallMatch) {
          podfileContent = podfileContent.replace(
            postInstallMatch[0],
            `${postInstallMatch[1]}${postInstallMatch[2]}${follyFix}${postInstallMatch[3]}`
          );
        }
      } else {
        // Create new post_install hook - add before the final 'end' of the target block
        // Find the last occurrence of 'end' that's likely the end of the target block
        const lines = podfileContent.split('\n');
        let lastEndIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim() === 'end') {
            lastEndIndex = i;
            break;
          }
        }
        if (lastEndIndex !== -1) {
          lines.splice(lastEndIndex, 0, `post_install do |installer|${follyFix}end`);
          podfileContent = lines.join('\n');
        }
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withFollyFix;

