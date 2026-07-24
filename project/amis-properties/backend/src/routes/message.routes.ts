import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApiError } from "../middleware/error";

const router = Router();
router.use(requireAuth);

/** Confirms the current user is either the customer or the agent on this conversation. */
async function assertParticipant(req: AuthedRequest, conversationId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { agent: true },
  });
  if (!convo) throw new ApiError(404, "Conversation not found");
  const isCustomer = convo.customerId === req.user!.id;
  const isAgent = convo.agent?.userId === req.user!.id;
  const isStaff = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
  if (!isCustomer && !isAgent && !isStaff) throw new ApiError(403, "You don't have access to this conversation");
  return convo;
}

/** Customer starts (or resumes) a conversation with the agent on a specific property. */
router.post(
  "/start",
  validate(z.object({ propertyId: z.string() })),
  async (req: AuthedRequest, res, next) => {
    try {
      const property = await prisma.property.findUnique({ where: { id: req.body.propertyId } });
      if (!property) throw new ApiError(404, "Property not found");

      const convo = await prisma.conversation.upsert({
        where: { propertyId_customerId: { propertyId: property.id, customerId: req.user!.id } },
        update: {},
        create: { propertyId: property.id, customerId: req.user!.id, agentId: property.agentId },
      });
      res.status(201).json(convo);
    } catch (err) {
      next(err);
    }
  }
);

/** All conversations for the current user — customer sees their own, agent sees theirs. */
router.get("/mine", async (req: AuthedRequest, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
    const convos = await prisma.conversation.findMany({
      where: agent ? { agentId: agent.id } : { customerId: req.user!.id },
      include: {
        property: { select: { title: true, slug: true, images: { take: 1 } } },
        customer: { select: { fullName: true, phone: true } },
        agent: { include: { user: { select: { fullName: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(convos);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/messages", async (req: AuthedRequest, res, next) => {
  try {
    await assertParticipant(req, req.params.id);
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/messages",
  validate(z.object({ body: z.string().min(1).max(2000) })),
  async (req: AuthedRequest, res, next) => {
    try {
      await assertParticipant(req, req.params.id);
      const message = await prisma.message.create({
        data: { conversationId: req.params.id, senderId: req.user!.id, body: req.body.body },
        include: { sender: { select: { fullName: true } } },
      });

      // Push it live to anyone already in this conversation's room.
      const io = req.app.get("io");
      if (io) io.to(req.params.id).emit("message:new", message);

      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
