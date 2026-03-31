import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.galleryEntry.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.discovery.deleteMany();
  await prisma.child.deleteMany();
  await prisma.accessCode.deleteMany();

  // Create valid access codes
  await prisma.accessCode.create({
    data: {
      code: "KATAL-001",
      active: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });

  await prisma.accessCode.create({
    data: {
      code: "KATAL-002",
      active: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });

  // Create expired access code
  await prisma.accessCode.create({
    data: {
      code: "KATAL-EXP",
      active: true,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
    },
  });

  console.log("Seed data created successfully:");
  console.log("  - Access code KATAL-001 (valid)");
  console.log("  - Access code KATAL-002 (valid)");
  console.log("  - Access code KATAL-EXP (expired)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
