import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { hashSecret } from "../utils/password";
import { ApiError } from "../middleware/error";

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "SUPER_ADMIN"));

/** Overview numbers for the dashboard landing page. */
router.get("/stats", async (_req, res, next) => {
  try {
    const [properties, available, users, agents, bookings, pendingBookings] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { status: "AVAILABLE" } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "AGENT" } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "PENDING" } }),
    ]);
    res.json({ properties, available, users, agents, bookings, pendingBookings });
  } catch (err) {
    next(err);
  }
});

/** Registered customers — name, phone, saved properties, inquiries. */
router.get("/users", async (req, res, next) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const perPage = 25;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: "CUSTOMER" },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          createdAt: true,
          _count: { select: { favorites: true, bookings: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
    ]);
    res.json({ items, total, page, totalPages: Math.ceil(total / perPage) });
  } catch (err) {
    next(err);
  }
});

/** All inspection bookings across every agent, for admin oversight. */
router.get("/bookings", async (_req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        customer: { select: { fullName: true, phone: true } },
        property: { select: { title: true, slug: true } },
        agent: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

/**
 * Broadcasts an in-app notification. This writes rows to the Notification table
 * so they show up in each customer's in-app notification list. It does NOT send
 * real SMS/push/WhatsApp — those need Twilio/FCM/WhatsApp Cloud API credentials,
 * which aren't configured (see README).
 */
const notifySchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  audience: z.enum(["ALL_CUSTOMERS", "SINGLE_USER"]),
  userId: z.string().optional(),
});

router.post("/notifications", validate(notifySchema), async (req, res, next) => {
  try {
    const { title, body, audience, userId } = req.body;
    const targetIds =
      audience === "SINGLE_USER" && userId
        ? [userId]
        : (await prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true } })).map((u) => u.id);

    await prisma.notification.createMany({
      data: targetIds.map((id: string) => ({ userId: id, channel: "IN_APP" as const, title, body })),
    });
    res.status(201).json({ message: `Notification queued for ${targetIds.length} customer(s)` });
  } catch (err) {
    next(err);
  }
});

/** All properties, including drafts/hidden — the admin table needs everything, not just AVAILABLE. */
router.get("/properties", async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      include: { images: { take: 1 }, city: true, agent: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(properties);
  } catch (err) {
    next(err);
  }
});

/** Provision a new agent account — email/password login, plus an Agent profile. */
const createAgentSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  bio: z.string().optional(),
  commissionPct: z.number().min(0).max(100).default(5),
});

router.post("/agents", validate(createAgentSchema), async (req: AuthedRequest, res, next) => {
  try {
    const { fullName, email, password, phone, bio, commissionPct } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "An account with this email already exists");

    const passwordHash = await hashSecret(password);
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        role: "AGENT",
        isVerified: true,
        agentProfile: { create: { bio, commissionPct } },
      },
      include: { agentProfile: true },
    });
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: "CREATE", entity: "Agent", entityId: user.id, metadata: { email } },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.get("/agents", async (_req, res, next) => {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        user: { select: { fullName: true, email: true, phone: true, isActive: true } },
        _count: { select: { properties: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(agents);
  } catch (err) {
    next(err);
  }
});

/** Real audit trail — who did what, when. Populated by login events and property writes. */
router.get("/audit-logs", async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { fullName: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
