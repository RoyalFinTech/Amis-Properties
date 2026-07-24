import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createSchema = z.object({
  propertyId: z.string(),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
});

// Customer books an inspection
router.post("/", requireAuth, validate(createSchema), async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.create({
      data: {
        customerId: req.user!.id,
        propertyId: req.body.propertyId,
        scheduledAt: new Date(req.body.scheduledAt),
        notes: req.body.notes,
      },
    });
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

// Customer views their own bookings
router.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { customerId: req.user!.id },
      include: { property: { include: { images: { take: 1 } } } },
      orderBy: { scheduledAt: "asc" },
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

// Agent/Admin: update status (confirm, reschedule, cancel, complete).
// Agents may only touch bookings on their own properties — admins may touch any.
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("AGENT", "ADMIN", "SUPER_ADMIN"),
  validate(z.object({ status: z.enum(["PENDING", "CONFIRMED", "RESCHEDULED", "CANCELLED", "COMPLETED"]) })),
  async (req: AuthedRequest, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { property: { include: { agent: true } } } });
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
      const isOwningAgent = booking.property?.agent?.userId === req.user!.id;
      if (!isAdmin && !isOwningAgent) {
        return res.status(403).json({ error: "You can only manage bookings on your own listings" });
      }

      const updated = await prisma.booking.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
      });
      await prisma.auditLog.create({
        data: { userId: req.user!.id, action: "STATUS_CHANGE", entity: "Booking", entityId: updated.id, metadata: { status: req.body.status } },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
