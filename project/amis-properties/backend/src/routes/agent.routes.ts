import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApiError } from "../middleware/error";

const router = Router();
router.use(requireAuth, requireRole("AGENT", "ADMIN", "SUPER_ADMIN"));

/** Resolves the Agent profile row for the currently authenticated staff user. */
async function currentAgent(req: AuthedRequest) {
  const agent = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
  if (!agent) throw new ApiError(404, "No agent profile is linked to this account yet — ask an admin to set one up.");
  return agent;
}

router.get("/me", async (req: AuthedRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } } },
    });
    if (!agent) return res.status(404).json({ error: "No agent profile linked to this account" });
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/me/availability",
  validate(z.object({ availability: z.boolean() })),
  async (req: AuthedRequest, res, next) => {
    try {
      const agent = await currentAgent(req);
      const updated = await prisma.agent.update({ where: { id: agent.id }, data: { availability: req.body.availability } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/** All of this agent's own listings, regardless of status (draft/hidden included). */
router.get("/listings", async (req: AuthedRequest, res, next) => {
  try {
    const agent = await currentAgent(req);
    const properties = await prisma.property.findMany({
      where: { agentId: agent.id },
      include: { images: { take: 1 }, city: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(properties);
  } catch (err) {
    next(err);
  }
});

/** Inspection bookings and offers for this agent's properties — their "leads". */
router.get("/leads", async (req: AuthedRequest, res, next) => {
  try {
    const agent = await currentAgent(req);
    const [bookings, offers] = await Promise.all([
      prisma.booking.findMany({
        where: { agentId: agent.id },
        include: { customer: { select: { fullName: true, phone: true } }, property: { select: { title: true, slug: true } } },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.offer.findMany({
        where: { property: { agentId: agent.id } },
        include: { customer: { select: { fullName: true, phone: true } }, property: { select: { title: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    res.json({ bookings, offers });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/leads/bookings/:id/status",
  validate(z.object({ status: z.enum(["PENDING", "CONFIRMED", "RESCHEDULED", "CANCELLED", "COMPLETED"]) })),
  async (req: AuthedRequest, res, next) => {
    try {
      const agent = await currentAgent(req);
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking || (booking.agentId && booking.agentId !== agent.id && req.user!.role === "AGENT")) {
        throw new ApiError(403, "This booking isn't assigned to you");
      }
      const updated = await prisma.booking.update({
        where: { id: req.params.id },
        data: { status: req.body.status, agentId: booking.agentId ?? agent.id },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/** Dashboard numbers: listings, pending leads, and a rough commission estimate. */
router.get("/stats", async (req: AuthedRequest, res, next) => {
  try {
    const agent = await currentAgent(req);
    const [totalListings, availableListings, pendingBookings, soldOrRented] = await Promise.all([
      prisma.property.count({ where: { agentId: agent.id } }),
      prisma.property.count({ where: { agentId: agent.id, status: "AVAILABLE" } }),
      prisma.booking.count({ where: { agentId: agent.id, status: "PENDING" } }),
      prisma.property.findMany({ where: { agentId: agent.id, status: { in: ["SOLD", "RENTED"] } }, select: { price: true } }),
    ]);
    const commissionPct = Number(agent.commissionPct);
    const commissionEstimate = soldOrRented.reduce((sum, p) => sum + (Number(p.price) * commissionPct) / 100, 0);
    res.json({ totalListings, availableListings, pendingBookings, commissionEstimate, commissionPct });
  } catch (err) {
    next(err);
  }
});

export default router;
