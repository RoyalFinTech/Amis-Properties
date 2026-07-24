import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { validate } from "../middleware/validate";
import * as authController from "../controllers/auth.controller";

const router = Router();

// Tighter limiter on OTP endpoints to prevent SMS-bombing abuse.
const otpLimiter = rateLimit({ windowMs: 10 * 60_000, max: 5 });

const requestOtpSchema = z.object({
  fullName: z.string().min(2).max(80),
  phone: z.string().regex(/^\+\d{7,15}$/, "Phone must be in international format, e.g. +2203012345"),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/),
  code: z.string().length(6),
});

const createPinSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(4).max(6),
});

const loginPinSchema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/),
  pin: z.string().min(4).max(6),
});

const loginStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

/**
 * @openapi
 * /api/auth/otp/request:
 *   post:
 *     summary: Register/login with full name + phone, triggers an SMS OTP
 */
router.post("/otp/request", otpLimiter, validate(requestOtpSchema), authController.requestOtp);

/**
 * @openapi
 * /api/auth/otp/verify:
 *   post:
 *     summary: Verify the 6-digit OTP sent to the customer's phone
 */
router.post("/otp/verify", otpLimiter, validate(verifyOtpSchema), authController.verifyOtp);

/**
 * @openapi
 * /api/auth/pin/create:
 *   post:
 *     summary: Set the customer's 4 or 6-digit security PIN after OTP verification
 */
router.post("/pin/create", validate(createPinSchema), authController.createPin);

/**
 * @openapi
 * /api/auth/pin/login:
 *   post:
 *     summary: Log back in with phone + PIN (returning users)
 */
router.post("/pin/login", validate(loginPinSchema), authController.loginPin);

/**
 * @openapi
 * /api/auth/staff/login:
 *   post:
 *     summary: Agent/Admin login with email + password
 */
router.post("/staff/login", validate(loginStaffSchema), authController.loginStaff);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Exchange a valid refresh token for a new access + refresh token pair
 */
router.post("/refresh", validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Revoke a refresh token — the real logout the system previously didn't have
 */
router.post("/logout", validate(refreshSchema), authController.logout);

export default router;
