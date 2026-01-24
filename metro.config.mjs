// Minimal metro config to avoid Windows path issues
export default {
  resolver: {
    sourceExts: ["js", "jsx", "ts", "tsx", "json", "cjs"],
    unstable_enablePackageExports: false,
  },
  transformer: {
    unstable_allowRequireContext: true,
  },
};
