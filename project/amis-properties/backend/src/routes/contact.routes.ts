import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { validate } from "../middleware/validate";

const router = Router();

/**
 * Public — loads the company's contact details from the Setting table (seeded as
 * "company_info") so the frontend never has to hardcode a phone number.
 */
router.get("/settings", async (_req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "company_info" } });
    if (!setting) {
      // Sensible fallback if the seed hasn't run yet — still real data, just not admin-editable until seeded.
      return res.json({
        name: "AMI'S PROPERTIES",
        tagline: "Your Trusted Property Partner",
        phone: "+220 6815386",
        whatsapp: "+220 6815386",
        email: "amispropertiesgambia@gmail.com",
        address: "Adjacent Winner School, Kotu Manjai, The Gambia",
      });
    }
    res.json(setting.value);
  } catch (err) {
    next(err);
  }
});

/**
 * Public — tracks a WhatsApp contact-button click for analytics. No auth required since
 * this fires from anonymous guest browsing, not just signed-in users. Writes to AuditLog
 * (userId is optional there) rather than adding a new table, since it's the same
 * "who did what, when, on what" shape.
 */
const trackSchema = z.object({
  propertyId: z.string().optional(),
  source: z.enum(["FLOATING_BUTTON", "PROPERTY_DETAIL", "CONTACT_PAGE"]).default("FLOATING_BUTTON"),
});

router.post("/whatsapp", validate(trackSchema), async (req, res, next) => {
  try {
    await prisma.auditLog.create({
      data: {
        action: "WHATSAPP_CLICK",
        entity: req.body.propertyId ? "Property" : "General",
        entityId: req.body.propertyId,
        metadata: {
          source: req.body.source,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          timestamp: new Date().toISOString(),
        },
      },
    });
    res.status(201).json({ message: "Tracked" });
  } catch (err) {
    next(err);
  }
});

export default router;
