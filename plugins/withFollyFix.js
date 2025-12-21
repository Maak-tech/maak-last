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
        // Add to existing post_install hook
        podfileContent = podfileContent.replace(
          /(post_install do \|installer\|)([\s\S]*?)(end)/,
          `$1$2${follyFix}$3`
        );
      } else {
        // Create new post_install hook before the last 'end' in the file
        const lastEndIndex = podfileContent.lastIndexOf("end");
        if (lastEndIndex !== -1) {
          podfileContent =
            podfileContent.slice(0, lastEndIndex) +
            `post_install do |installer|${follyFix}end\n` +
            podfileContent.slice(lastEndIndex);
        }
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};

module.exports = withFollyFix;

