import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "amispropertiesgambia@gmail.com" },
    update: {},
    create: {
      fullName: "AMI'S Properties Admin",
      email: "amispropertiesgambia@gmail.com",
      passwordHash,
      role: "SUPER_ADMIN",
      isVerified: true,
    },
  });

  const country = await prisma.country.upsert({
    where: { code: "GM" },
    update: {},
    create: { name: "The Gambia", code: "GM" },
  });

  const state = await prisma.state.upsert({
    where: { name_countryId: { name: "West Coast Region", countryId: country.id } },
    update: {},
    create: { name: "West Coast Region", countryId: country.id },
  });

  const city = await prisma.city.upsert({
    where: { name_stateId: { name: "Kotu", stateId: state.id } },
    update: {},
    create: { name: "Kotu", stateId: state.id },
  });

  const category = await prisma.category.upsert({
    where: { slug: "luxury-villas" },
    update: {},
    create: { name: "Luxury Villas", slug: "luxury-villas" },
  });

  const amenityNames = ["Swimming Pool", "Parking", "Garden", "24/7 Security", "Gym", "WiFi", "Air Conditioning"];
  const amenities = await Promise.all(
    amenityNames.map((name) => prisma.amenity.upsert({ where: { name }, update: {}, create: { name } }))
  );

  await prisma.property.upsert({
    where: { slug: "sample-luxury-villa-kotu" },
    update: {},
    create: {
      title: "Sample Luxury Villa in Kotu",
      slug: "sample-luxury-villa-kotu",
      description: "A tastefully finished 4-bedroom villa near Kotu beach — replace with real listings from the admin dashboard.",
      type: "VILLA",
      purpose: "SALE",
      status: "AVAILABLE",
      price: 15000000,
      currency: "GMD",
      bedrooms: 4,
      bathrooms: 4,
      kitchens: 1,
      parkingSpaces: 2,
      isFeatured: true,
      cityId: city.id,
      categoryId: category.id,
      amenities: { connect: amenities.map((a) => ({ id: a.id })) },
    },
  });

  await prisma.setting.upsert({
    where: { key: "company_info" },
    update: {},
    create: {
      key: "company_info",
      value: {
        name: "AMI'S PROPERTIES",
        tagline: "Your Trusted Property Partner",
        phone: "+220 6815386",
        whatsapp: "+220 6815386",
        email: "amispropertiesgambia@gmail.com",
        address: "Adjacent Winner School, Kotu Manjai, The Gambia",
      },
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Admin login: ${admin.email} / ChangeMe123! (change this immediately)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
