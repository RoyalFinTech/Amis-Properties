import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, fullName: true, phone: true, email: true, role: true, avatarUrl: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/me",
  requireAuth,
  validate(z.object({ fullName: z.string().min(2).optional(), avatarUrl: z.string().url().optional() })),
  async (req: AuthedRequest, res, next) => {
    try {
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: req.body });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
