import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";

export async function requestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { fullName, phone } = req.body;
    const result = await authService.requestPhoneOtp(fullName, phone);
    res.status(200).json({ message: "Verification code sent", ...result });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, code } = req.body;
    const user = await authService.verifyPhoneOtp(phone, code);
    res.status(200).json({ message: "Phone verified", userId: user.id, hasPinSet: !!user.pinHash });
  } catch (err) {
    next(err);
  }
}

export async function createPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, pin } = req.body;
    const tokens = await authService.setSecurityPin(userId, pin);
    res.status(200).json({ message: "PIN created", ...tokens });
  } catch (err) {
    next(err);
  }
}

export async function loginPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, pin } = req.body;
    const tokens = await authService.loginWithPin(phone, pin);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function loginStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const tokens = await authService.loginWithPassword(email, password);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.rotateRefreshToken(refreshToken);
    res.status(200).json(tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
}
