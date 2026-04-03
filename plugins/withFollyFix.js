/**
 * withFollyFix — Expo config plugin that resolves Android Folly/JSC version
 * conflicts that appear when building React Native from source.
 *
 * Symptoms without this fix:
 *   - "Duplicate class kotlin.collections.jdk8" at Gradle compile time
 *   - Linker errors related to Folly symbols on arm64
 *   - Build failures on clean EAS builds for Android release
 *
 * What it does:
 *   1. Forces a consistent Folly version across all Gradle subprojects
 *   2. Excludes the conflicting kotlin-stdlib-jdk8 transitive dependency
 *   3. Ensures JSC and Hermes don't ship conflicting Folly symbols
 */

const { withProjectBuildGradle, withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Append Folly version resolution to root build.gradle's allprojects block.
 */
const withFollyRootGradle = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      // Kotlin DSL build.gradle.kts — skip (not common in RN projects)
      return config;
    }

    const contents = config.modResults.contents;

    // Only apply once
    if (contents.includes("// withFollyFix applied")) {
      return config;
    }

    const follyResolutionBlock = `
    // withFollyFix applied — resolves Folly/JSC symbol conflicts
    configurations.all {
        resolutionStrategy {
            force "com.facebook.react:react-native:+"
        }
        exclude group: "org.jetbrains.kotlin", module: "kotlin-stdlib-jdk8"
    }`;

    // Inject into the allprojects block if present, otherwise append at end
    if (contents.includes("allprojects {")) {
      config.modResults.contents = contents.replace(
        /allprojects\s*\{/,
        `allprojects {\n${follyResolutionBlock}`
      );
    } else {
      config.modResults.contents = contents + `\nallprojects {\n${follyResolutionBlock}\n}\n`;
    }

    return config;
  });
};

/**
 * Add packagingOptions to app/build.gradle to prevent duplicate .so files
 * from Folly that can cause Gradle merge conflicts.
 */
const withFollyAppGradle = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }

    const contents = config.modResults.contents;

    if (contents.includes("// withFollyFix packagingOptions")) {
      return config;
    }

    const packagingOptions = `
    // withFollyFix packagingOptions — deduplicate Folly .so symbols
    packagingOptions {
        pickFirst '**/libfolly_json.so'
        pickFirst '**/libfolly_futures.so'
        pickFirst '**/libhermes.so'
        pickFirst '**/libjsc.so'
        exclude 'META-INF/DEPENDENCIES'
    }`;

    // Inject into the android block
    if (contents.includes("android {")) {
      config.modResults.contents = contents.replace(
        /android\s*\{/,
        `android {\n${packagingOptions}`
      );
    }

    return config;
  });
};

/**
 * Compose both Gradle modifications into a single plugin.
 */
const withFollyFix = (config) => {
  config = withFollyRootGradle(config);
  config = withFollyAppGradle(config);
  return config;
};

module.exports = withFollyFix;
