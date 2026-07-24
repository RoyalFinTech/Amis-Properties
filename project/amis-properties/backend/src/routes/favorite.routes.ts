import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.id },
      include: { property: { include: { images: { take: 1 } } } },
    });
    res.json(favorites);
  } catch (err) {
    next(err);
  }
});

router.post("/:propertyId", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const favorite = await prisma.favorite.upsert({
      where: { userId_propertyId: { userId: req.user!.id, propertyId: req.params.propertyId } },
      create: { userId: req.user!.id, propertyId: req.params.propertyId },
      update: {},
    });
    res.status(201).json(favorite);
  } catch (err) {
    next(err);
  }
});

router.delete("/:propertyId", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.favorite.delete({
      where: { userId_propertyId: { userId: req.user!.id, propertyId: req.params.propertyId } },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
