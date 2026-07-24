import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import * as propertyService from "../services/property.service";
import { AuthedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/error";

/** Validates the actual property fields — previously this was completely unvalidated. */
const propertyWriteSchema = z.object({
  title: z.string().min(3).max(150),
  slug: z.string().min(3).max(160).optional(),
  description: z.string().min(10).max(5000),
  type: z.enum(["VILLA", "APARTMENT", "COMMERCIAL", "LAND", "WAREHOUSE", "NEW_DEVELOPMENT"]),
  purpose: z.enum(["SALE", "RENT", "LEASE", "SHORT_STAY"]),
  status: z.enum(["DRAFT", "PENDING", "AVAILABLE", "SOLD", "RENTED", "HIDDEN"]).optional(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  kitchens: z.number().int().min(0).max(20).optional(),
  parkingSpaces: z.number().int().min(0).max(100).optional(),
  landSizeSqm: z.number().nonnegative().optional(),
  propertySizeSqm: z.number().nonnegative().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  cityId: z.string().optional(),
  categoryId: z.string().optional(),
  isFeatured: z.boolean().optional(),
  images: z.unknown().optional(),
  videos: z.unknown().optional(),
  floorPlans: z.unknown().optional(),
  amenities: z.unknown().optional(),
}).passthrough(); // allow Prisma nested-write shapes like { images: { create: [...] } } through untouched

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await propertyService.searchProperties(req.query as never);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.getPropertyBySlug(req.params.slug);
    res.json(property);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    // agentId is derived from the authenticated user, never trusted from the request body —
    // an agent can only ever create listings under their own name. Admins may pass an
    // explicit agentId in body.data.agentIdOverride to assign a listing to a specific agent.
    let agentId: string | null = null;
    if (req.user!.role === "AGENT") {
      const agent = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
      if (!agent) throw new ApiError(404, "No agent profile is linked to this account");
      agentId = agent.id;
    } else if (req.body.agentIdOverride) {
      agentId = req.body.agentIdOverride; // admin explicitly assigning to another agent
    }

    const parsed = propertyWriteSchema.parse(req.body.data);
    const property = await propertyService.createProperty(agentId, parsed as never);
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: "CREATE", entity: "Property", entityId: property.id, metadata: { title: property.title } },
    });
    res.status(201).json(property);
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    await propertyService.assertCanManageProperty(req.params.id, req.user!.id, req.user!.role);
    const parsed = propertyWriteSchema.partial().parse(req.body);
    const property = await propertyService.updateProperty(req.params.id, parsed as never);
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: "UPDATE", entity: "Property", entityId: property.id, metadata: { fields: Object.keys(parsed) } },
    });
    res.json(property);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    await propertyService.assertCanManageProperty(req.params.id, req.user!.id, req.user!.role);
    await propertyService.deleteProperty(req.params.id);
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: "DELETE", entity: "Property", entityId: req.params.id },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function setStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    await propertyService.assertCanManageProperty(req.params.id, req.user!.id, req.user!.role);
    const property = await propertyService.setPropertyStatus(req.params.id, req.body.status);
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: "STATUS_CHANGE", entity: "Property", entityId: property.id, metadata: { status: req.body.status } },
    });
    res.json(property);
  } catch (err) {
    next(err);
  }
}
