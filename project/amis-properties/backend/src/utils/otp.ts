import crypto from "crypto";
import { env } from "../config/env";

export function generateOtp(): string {
  // 6-digit numeric code
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Sends an OTP via SMS using Twilio when credentials are configured.
 * Falls back to logging the code to the server console in development
 * so you can test the flow before connecting a real SMS provider.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    // Lazy import so the app doesn't require twilio unless it's actually configured.
    const twilio = (await import("twilio")).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to: phone,
      from: env.TWILIO_FROM_NUMBER,
      body: `Your AMI'S PROPERTIES verification code is ${code}. It expires in 5 minutes.`,
    });
    return;
  }

  // No SMS provider configured yet — this keeps local development unblocked.
  console.log(`[DEV OTP] ${phone} -> ${code} (configure TWILIO_* in .env to send real SMS)`);
}
