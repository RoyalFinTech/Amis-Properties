import { prisma } from "../lib/prisma";
import { hashSecret, verifySecret } from "../utils/password";
import { generateOtp, sendOtpSms } from "../utils/otp";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { ApiError } from "../middleware/error";

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function assertNotLocked(user: { id: string; lockedUntil: Date | null }) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new ApiError(423, `Account temporarily locked after repeated failed attempts. Try again in ${minutesLeft} minute(s).`);
  }
}
async function registerFailedAttempt(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
  });
  if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000), failedLoginAttempts: 0 },
    });
    await revokeAllSessions(userId);
    await prisma.auditLog.create({
      data: { userId, action: "ACCOUNT_LOCKED", entity: "User", entityId: userId, metadata: { reason: "Too many failed login attempts", sessionsRevoked: true } },
    });
  }
}
async function clearFailedAttempts(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
}

export async function requestPhoneOtp(fullName: string, phone: string) {
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { fullName, phone, role: "CUSTOMER" } });
  }

  const code = generateOtp();
  const codeHash = await hashSecret(code);
  await prisma.otpCode.create({
    data: {
      userId: user.id,
      phone,
      codeHash,
      purpose: "LOGIN",
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  });

  await sendOtpSms(phone, code);
  return { userId: user.id };
}

export async function verifyPhoneOtp(phone: string, code: string) {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose: "LOGIN" },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new ApiError(400, "No verification code was requested for this number");
  if (otp.expiresAt < new Date()) throw new ApiError(400, "Verification code has expired — request a new one");
  if (otp.attempts >= MAX_OTP_ATTEMPTS) throw new ApiError(429, "Too many attempts — request a new code");

  const valid = await verifySecret(code, otp.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, "Incorrect verification code");
  }

  const user = await prisma.user.update({
    where: { phone },
    data: { isVerified: true },
  });

  return user;
}

export async function setSecurityPin(userId: string, pin: string) {
  if (!/^\d{4}$/.test(pin) && !/^\d{6}$/.test(pin)) {
    throw new ApiError(400, "PIN must be 4 or 6 digits");
  }
  const sameDigit = pin.split("").every((d) => d === pin[0]);
  const ascending = "0123456789".includes(pin);
  const descending = "9876543210".includes(pin);
  if (sameDigit || ascending || descending) {
    throw new ApiError(400, "PIN is too easy to guess — choose a less predictable combination");
  }

  const pinHash = await hashSecret(pin);
  const user = await prisma.user.update({ where: { id: userId }, data: { pinHash } });
  return issueTokens(user.id, user.role);
}

export async function loginWithPin(phone: string, pin: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user?.pinHash) throw new ApiError(400, "No PIN set for this account");
  await assertNotLocked(user);
  const valid = await verifySecret(pin, user.pinHash);
  if (!valid) {
    await registerFailedAttempt(user.id);
    throw new ApiError(401, "Incorrect PIN");
  }
  await clearFailedAttempts(user.id);
  await prisma.auditLog.create({ data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, metadata: { method: "PIN" } } });
  return issueTokens(user.id, user.role);
}

/** Email + password login — used by Agents and Admins, not customers. */
export async function loginWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) throw new ApiError(401, "Invalid email or password");
  await assertNotLocked(user);
  const valid = await verifySecret(password, user.passwordHash);
  if (!valid) {
    await registerFailedAttempt(user.id);
    throw new ApiError(401, "Invalid email or password");
  }
  if (!["AGENT", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    throw new ApiError(403, "This login is for staff accounts only");
  }
  await clearFailedAttempts(user.id);
  await prisma.auditLog.create({ data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, metadata: { method: "PASSWORD" } } });
  return issueTokens(user.id, user.role);
}

export async function issueTokens(userId: string, role: string) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId });
  const tokenHash = await hashSecret(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    },
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new ApiError(401, "User no longer exists");
  await assertNotLocked(user);

  // Find the matching stored token by comparing against every non-revoked, non-expired
  // token hash for this user (tokens are hashed at rest, so we can't look up by value directly).
  const candidates = await prisma.refreshToken.findMany({
    where: { userId: user.id, revoked: false, expiresAt: { gt: new Date() } },
  });
  let matched: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    if (await verifySecret(refreshToken, candidate.tokenHash)) {
      matched = candidate;
      break;
    }
  }
  if (!matched) throw new ApiError(401, "This refresh token has already been used or revoked — please sign in again");

  // Single-use rotation: revoke the token we just consumed before issuing a new pair.
  await prisma.refreshToken.update({ where: { id: matched.id }, data: { revoked: true } });
  return issueTokens(user.id, user.role);
}

/** Revokes a specific refresh token — the real logout the system was previously missing. */
export async function logout(refreshToken: string) {
  const active = await prisma.refreshToken.findMany({ where: { revoked: false } });
  for (const token of active) {
    if (await verifySecret(refreshToken, token.tokenHash)) {
      await prisma.refreshToken.update({ where: { id: token.id }, data: { revoked: true } });
      return;
    }
  }
  // If we didn't find it, it's already invalid/expired/revoked — logout is a no-op either way, not an error.
}

/** Revokes every active refresh token for a user — used after an account lockout, so an
 *  already-issued session can't keep working even though new logins are blocked. */
export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
}
