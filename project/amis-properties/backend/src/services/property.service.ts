import { Prisma, PropertyStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/error";

export interface PropertySearchQuery {
  q?: string;
  cityId?: string;
  type?: string;
  purpose?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  amenityIds?: string; // comma-separated
  page?: string;
  perPage?: string;
  sort?: "price_asc" | "price_desc" | "newest";
}

export async function searchProperties(query: PropertySearchQuery) {
  const page = Math.max(parseInt(query.page ?? "1", 10), 1);
  const perPage = Math.min(Math.max(parseInt(query.perPage ?? "12", 10), 1), 50);

  const where: Prisma.PropertyWhereInput = {
    status: "AVAILABLE" as PropertyStatus,
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ],
    }),
    ...(query.cityId && { cityId: query.cityId }),
    ...(query.type && { type: query.type as never }),
    ...(query.purpose && { purpose: query.purpose as never }),
    ...(query.bedrooms && { bedrooms: { gte: parseInt(query.bedrooms, 10) } }),
    ...(query.bathrooms && { bathrooms: { gte: parseInt(query.bathrooms, 10) } }),
    ...((query.minPrice || query.maxPrice) && {
      price: {
        ...(query.minPrice && { gte: new Prisma.Decimal(query.minPrice) }),
        ...(query.maxPrice && { lte: new Prisma.Decimal(query.maxPrice) }),
      },
    }),
    ...(query.amenityIds && {
      amenities: { some: { id: { in: query.amenityIds.split(",") } } },
    }),
  };

  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    query.sort === "price_asc"
      ? { price: "asc" }
      : query.sort === "price_desc"
      ? { price: "desc" }
      : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { images: { take: 1, orderBy: { sortOrder: "asc" } }, city: true, agent: { include: { user: true } } },
    }),
    prisma.property.count({ where }),
  ]);

  return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

export async function getPropertyBySlug(slug: string) {
  const property = await prisma.property.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      videos: true,
      floorPlans: true,
      amenities: true,
      city: { include: { state: { include: { country: true } } } },
      agent: { include: { user: true } },
      reviews: { include: { user: true } },
    },
  });
  if (!property) throw new ApiError(404, "Property not found");

  await prisma.property.update({ where: { slug }, data: { viewCount: { increment: 1 } } });
  return property;
}

export async function createProperty(agentId: string | null, data: Prisma.PropertyCreateInput) {
  return prisma.property.create({ data: { ...data, ...(agentId && { agent: { connect: { id: agentId } } }) } });
}

/** Throws unless the requester is the property's own agent or an admin. Agents may only touch their own listings. */
export async function assertCanManageProperty(propertyId: string, requesterUserId: string, requesterRole: string) {
  if (requesterRole === "ADMIN" || requesterRole === "SUPER_ADMIN") return;
  const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { agent: true } });
  if (!property) throw new ApiError(404, "Property not found");
  if (!property.agent || property.agent.userId !== requesterUserId) {
    throw new ApiError(403, "You can only manage your own listings");
  }
}

export async function updateProperty(id: string, data: Prisma.PropertyUpdateInput) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Property not found");
  return prisma.property.update({ where: { id }, data });
}

export async function deleteProperty(id: string) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Property not found");
  await prisma.property.delete({ where: { id } });
}

export async function setPropertyStatus(id: string, status: PropertyStatus) {
  return prisma.property.update({ where: { id }, data: { status } });
}
