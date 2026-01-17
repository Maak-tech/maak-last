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
      // --- Patch @kingstinct/react-native-healthkit podspec to avoid umbrella importing Bridge.h ---
      // CocoaPods generates `ReactNativeHealthkit-umbrella.h` importing all public headers with:
      //   #import "Header.h"
      // When `Bridge.h` is exported as public, it gets pulled into the umbrella. In some static
      // frameworks setups, that import fails, breaking the module build. `Bridge.h` is internal
      // (and currently empty), so we exclude it from public headers at the podspec level.
      try {
        const projectRoot = config.modRequest.projectRoot;
        const healthkitPodspecPath = path.join(
          projectRoot,
          "node_modules",
          "@kingstinct",
          "react-native-healthkit",
          "ReactNativeHealthkit.podspec"
        );
        const healthkitNitroAutolinkingPath = path.join(
          projectRoot,
          "node_modules",
          "@kingstinct",
          "react-native-healthkit",
          "nitrogen",
          "generated",
          "ios",
          "ReactNativeHealthkit+autolinking.rb"
        );

        if (fs.existsSync(healthkitPodspecPath)) {
          const podspec = fs.readFileSync(healthkitPodspecPath, "utf-8");

          // Skip if already patched
          if (!podspec.includes("public_headers -= Dir[\"ios/Bridge.h\"]")) {
            const patched = podspec.replace(
              /s\.public_header_files\s*=\s*["']ios\/\*\*\/\*\.h["']\s*\n/g,
              [
                '  # Patch: exclude Bridge.h from public headers to prevent umbrella import failures',
                '  # Also set header_mappings_dir so umbrella imports like `#import "ExceptionCatcher.h"` resolve.',
                '  s.header_mappings_dir = "ios"',
                '  public_headers = Dir["ios/**/*.h"]',
                '  public_headers -= Dir["ios/Bridge.h"]',
                "  s.public_header_files = public_headers",
                '  s.private_header_files = Dir["ios/Bridge.h"]',
                "",
              ].join("\n") + "\n"
            );

            if (patched !== podspec) {
              fs.writeFileSync(healthkitPodspecPath, patched);
            }
          }

          // Ensure the pod target can always resolve its own ios headers (ExceptionCatcher.h) from the umbrella.
          // Add HEADER_SEARCH_PATHS to pod_target_xcconfig if missing.
          const latestPodspec = fs.readFileSync(healthkitPodspecPath, "utf-8");
          if (
            latestPodspec.includes("s.pod_target_xcconfig") &&
            !latestPodspec.includes('"HEADER_SEARCH_PATHS"') &&
            !latestPodspec.includes("'HEADER_SEARCH_PATHS'")
          ) {
            const withHeaderSearch = latestPodspec.replace(
              /("GCC_PREPROCESSOR_DEFINITIONS"\s*=>\s*["'][^"']*["']\s*)\n(\s*}\s*)/,
              [
                "$1,",
                '    "HEADER_SEARCH_PATHS" => "$(inherited) \\"$(PODS_TARGET_SRCROOT)/ios\\""',
                "$2",
              ].join("\n")
            );
            if (withHeaderSearch !== latestPodspec) {
              fs.writeFileSync(healthkitPodspecPath, withHeaderSearch);
            }
          }
        }

        // Patch Nitrogen autolinking so it does NOT add generated .hpp headers as public headers.
        // When public, CocoaPods' umbrella header imports them and breaks module compilation under
        // static frameworks.
        if (fs.existsSync(healthkitNitroAutolinkingPath)) {
          const rb = fs.readFileSync(healthkitNitroAutolinkingPath, "utf-8");
          if (!rb.includes("Treat Nitrogen-generated headers as PRIVATE")) {
            let patchedRb = rb;
            // Remove the block that appends generated headers to public_header_files
            patchedRb = patchedRb.replace(
              /current_public_header_files = Array\(spec\.attributes_hash\['public_header_files'\]\)\s*\n\s*spec\.public_header_files = current_public_header_files \+ \[\s*[\s\S]*?\n\s*\]\s*\n/m,
              [
                "  # IMPORTANT:",
                "  # Treat Nitrogen-generated headers as PRIVATE.",
                "  # When these headers are public, CocoaPods generates an umbrella header that imports them",
                "  # (including C++ .hpp files). In some static-framework setups this breaks module compilation.",
                "  current_public_header_files = Array(spec.attributes_hash['public_header_files'])",
                "  spec.public_header_files = current_public_header_files",
                "",
              ].join("\n")
            );

            // Ensure the generated headers are included as private headers
            if (!patchedRb.includes('\"nitrogen/generated/shared/**/*.{h,hpp}\"')) {
              patchedRb = patchedRb.replace(
                /spec\.private_header_files = current_private_header_files \+ \[\s*\n/m,
                (m) =>
                  m +
                  [
                    "    # Generated specs (kept private to avoid umbrella/modulemap issues)",
                    '    "nitrogen/generated/shared/**/*.{h,hpp}",',
                    "    # Swift to C++ bridging helpers (private)",
                    '    "nitrogen/generated/ios/ReactNativeHealthkit-Swift-Cxx-Bridge.hpp",',
                  ].join("\n") +
                  "\n"
              );
            }

            if (patchedRb !== rb) {
              fs.writeFileSync(healthkitNitroAutolinkingPath, patchedRb);
            }
          }
        }
      } catch (e) {
        // Best-effort patch; don't fail the build if node_modules isn't present at this phase.
      }

      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Add modular headers for specific Firebase dependencies that need it
      // This is required because Firebase Swift pods depend on pods that don't define modules
      if (!podfileContent.includes("pod 'GoogleUtilities', :modular_headers => true")) {
        const targetMatch = podfileContent.match(/target\s+['"][\w-]+['"]\s+do/);
        if (targetMatch) {
          const insertPoint = podfileContent.indexOf(targetMatch[0]);
          const firebaseModularHeaders = `# Enable modular headers for Firebase dependencies
pod 'GoogleUtilities', :modular_headers => true
pod 'FirebaseAuthInterop', :modular_headers => true
pod 'FirebaseAppCheckInterop', :modular_headers => true
pod 'RecaptchaInterop', :modular_headers => true
pod 'FirebaseCoreInternal', :modular_headers => true

`;
          podfileContent = podfileContent.slice(0, insertPoint) + firebaseModularHeaders + podfileContent.slice(insertPoint);
        }
      }

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
  
  # Don't modify the umbrella header - instead ensure all headers can be found
  # The umbrella header is generated by CocoaPods and modifying it can break the build
  # Instead, we'll ensure all necessary header paths are configured correctly
  
      # Fix for React Native modules that can't find headers
      # Add React Native header search paths to all pod targets
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Get existing header search paths or initialize
      existing_paths = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
      
      # Add React Native header paths for static frameworks
      react_paths = [
        '$(PODS_CONFIGURATION_BUILD_DIR)/React-Core/React-Core.framework/Headers',
        '$(PODS_CONFIGURATION_BUILD_DIR)/React-Core/React_Core.framework/Headers',
        '$(PODS_ROOT)/Headers/Public/React-Core',
        '$(PODS_ROOT)/Headers/Public/React-Core/React',
        '$(PODS_ROOT)/Headers/Private/React-Core',
        '$(PODS_CONFIGURATION_BUILD_DIR)/React/React.framework/Headers',
        '$(PODS_ROOT)/Headers/Public/React',
        '$(PODS_ROOT)/../../node_modules/react-native/React',
        '$(PODS_ROOT)/../../node_modules/react-native/ReactCommon',
        '$(SRCROOT)/../node_modules/react-native/React',
        '$(SRCROOT)/../node_modules/react-native/ReactCommon'
      ]
      
      # Add paths for ReactNativeHealthkit
      if target.name == 'ReactNativeHealthkit'
        healthkit_paths = [
          '$(PODS_ROOT)/../node_modules/@kingstinct/react-native-healthkit/ios',
          '$(SRCROOT)/../node_modules/@kingstinct/react-native-healthkit/ios'
        ]
        react_paths.concat(healthkit_paths)
      end
      
      # Add paths if not already present
      react_paths.each do |path|
        existing_paths << path unless existing_paths.include?(path)
      end
      
      config.build_settings['HEADER_SEARCH_PATHS'] = existing_paths
      
      # Allow non-modular includes in framework modules (required for Bridge.h)
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      
    end
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
