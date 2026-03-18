import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { phoneNumber } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { db } from "../db";

// OTP sender via Twilio (reuses existing Twilio integration)
async function sendOTPViaTwilio(phone: string, code: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    To: phone,
    From: process.env.TWILIO_PHONE_NUMBER ?? "",
    Body: `Your Nuralix verification code: ${code}. Valid for 10 minutes.`,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error("[Twilio OTP]", await response.text());
    throw new Error("Failed to send OTP");
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    expo(), // Expo/React Native session support
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY ?? "",
    }),
    phoneNumber({
      sendOTP: async ({ phoneNumber: phone, code }) => {
        await sendOTPViaTwilio(phone, code);
      },
      otpLength: 6,
      expiresIn: 600, // 10 minutes
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? "",
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh if > 1 day old
  },
  trustedOrigins: [
    "https://app.nuralix.ai",
    "nuralix://", // Expo deep link scheme
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
