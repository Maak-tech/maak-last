# Maak Health

## Known Issues / Notes

### Expo Doctor Warnings

**False Positive: expo-health-connect duplicate dependency**

When running `npx expo-doctor`, you may see a warning about duplicate `expo-health-connect` dependencies:

```
Found duplicates for expo-health-connect:
  ├─ expo-health-connect@1.0.0 (at: modules/expo-health-connect)
  └─ expo-health-connect@1.0.0 (at: node_modules/expo-health-connect)
```

**This is a false positive and can be safely ignored.** 

`expo-health-connect` is a local file dependency (`file:./modules/expo-health-connect`) that Bun copies into `node_modules` during installation. Expo-doctor sees both the source directory and the installed copy and incorrectly flags it as a duplicate. This is expected behavior for local file dependencies and will not cause build issues.

The module is properly configured for Expo autolinking and will work correctly in builds.
