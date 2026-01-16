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
  
  # Fix for ReactNativeHealthkit umbrella header internal headers issue
  # The umbrella header tries to import internal C++ headers which causes build failures
  umbrella_header = "Pods/Target Support Files/ReactNativeHealthkit/ReactNativeHealthkit-umbrella.h"
  if File.exist?(umbrella_header)
    text = File.read(umbrella_header)
    # Comment out C++ headers that cause build failures in the umbrella header
    # ExceptionCatcher.h is needed by Swift files, but we'll ensure it can be found via paths
    # Only C++ (.hpp) headers and Bridge.h (C++ bridge) are commented out
    internal_headers = [
      'Bridge.h',
      'AggregationStyle.hpp',
      'AuthDataTypes.hpp',
      'QueryDataTypes.hpp'
    ]
    new_contents = text
    internal_headers.each do |header|
      new_contents = new_contents.gsub('#import "' + header + '"', '// #import "' + header + '" // Commented out - internal header')
    end
    
    # If ExceptionCatcher.h import exists, ensure it uses a path that can be found
    # Replace relative import with explicit path if needed
    if new_contents.include?('#import "ExceptionCatcher.h"')
      # Keep the import but ensure paths are set up correctly (done below)
      # The import stays as-is, we just ensure the paths include the ios directory
    end
    
    File.open(umbrella_header, "w") { |f| f.puts new_contents }
  end
  
  # Fix for React Native modules that can't find headers when using static frameworks
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
      
      # For ReactNativeHealthkit specifically, add its source directory and subdirectories
      if target.name == 'ReactNativeHealthkit'
        healthkit_paths = [
          '$(PODS_ROOT)/ReactNativeHealthkit',
          '$(PODS_ROOT)/ReactNativeHealthkit/ios',
          '$(PODS_ROOT)/../node_modules/@kingstinct/react-native-healthkit',
          '$(PODS_ROOT)/../node_modules/@kingstinct/react-native-healthkit/ios',
          '$(SRCROOT)/../node_modules/@kingstinct/react-native-healthkit',
          '$(SRCROOT)/../node_modules/@kingstinct/react-native-healthkit/ios',
          '$(SRCROOT)/../../node_modules/@kingstinct/react-native-healthkit/ios',
          '$(PODS_CONFIGURATION_BUILD_DIR)/ReactNativeHealthkit',
          '$(PODS_ROOT)/Headers/Private/ReactNativeHealthkit',
          '$(PODS_ROOT)/Headers/Public/ReactNativeHealthkit'
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
      
      # For ReactNativeHealthkit, also set USER_HEADER_SEARCH_PATHS and allow recursive search
      if target.name == 'ReactNativeHealthkit'
        user_paths = config.build_settings['USER_HEADER_SEARCH_PATHS'] || ['$(inherited)']
        healthkit_user_paths = [
          '$(PODS_ROOT)/ReactNativeHealthkit/ios',
          '$(SRCROOT)/../node_modules/@kingstinct/react-native-healthkit/ios',
          '$(SRCROOT)/../../node_modules/@kingstinct/react-native-healthkit/ios',
          '$(PODS_ROOT)/../node_modules/@kingstinct/react-native-healthkit/ios'
        ]
        healthkit_user_paths.each do |path|
          user_paths << path unless user_paths.include?(path)
        end
        config.build_settings['USER_HEADER_SEARCH_PATHS'] = user_paths
        
        # Enable recursive header search for ReactNativeHealthkit
        config.build_settings['USE_HEADERMAP'] = 'YES'
        config.build_settings['ALWAYS_SEARCH_USER_PATHS'] = 'YES'
        
        # Also ensure the pod's own source directory is in the header search paths
        config.build_settings['HEADER_SEARCH_PATHS'] = existing_paths
        
        # Set the public headers path explicitly
        config.build_settings['PUBLIC_HEADERS_FOLDER_PATH'] = '$(PODS_ROOT)/ReactNativeHealthkit/ios'
      end
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
