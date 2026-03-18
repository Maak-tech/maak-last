import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

/**
 * Better-auth client for Expo.
 * Sessions are stored in expo-secure-store (replaces Firebase Auth persistence).
 * On web, sessions are stored as httpOnly cookies set by the Better-auth server.
 */
export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  plugins: [
    expoClient({
      scheme: "nuralix",
      storage: SecureStore,
      storagePrefix: "nuralix",
    }),
  ],
});

export type Session = typeof authClient.$Infer.Session;
export type AuthUser = typeof authClient.$Infer.Session.user;
