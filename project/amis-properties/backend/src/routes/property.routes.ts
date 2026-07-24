import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import * as propertyController from "../controllers/property.controller";

const router = Router();

const statusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "AVAILABLE", "SOLD", "RENTED", "HIDDEN"]),
});

// Public
router.get("/", propertyController.search);
router.get("/:slug", propertyController.getOne);

// Agent + Admin only
router.post("/", requireAuth, requireRole("AGENT", "ADMIN", "SUPER_ADMIN"), propertyController.create);
router.patch("/:id", requireAuth, requireRole("AGENT", "ADMIN", "SUPER_ADMIN"), propertyController.update);
router.delete("/:id", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), propertyController.remove);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("AGENT", "ADMIN", "SUPER_ADMIN"),
  validate(statusSchema),
  propertyController.setStatus
);

export default router;
