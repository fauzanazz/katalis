import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  // Clean existing data
  await prisma.moderationEvent.deleteMany();
  await prisma.reflectionEntry.deleteMany();
  await prisma.childBadge.deleteMany();
  await prisma.adjustmentEvent.deleteMany();
  await prisma.mentorMessage.deleteMany();
  await prisma.mentorSession.deleteMany();
  await prisma.galleryEntry.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.discovery.deleteMany();
  await prisma.child.deleteMany();
  await prisma.accessCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rateLimit.deleteMany();

  // ── Seed Users ──────────────────────────────────────────────────────
  const users = [
    {
      email: "admin@katalis.ai",
      name: "Admin",
      password: "admin123",
      role: "admin",
    },
    {
      email: "test@katalis.ai",
      name: "Test User",
      password: "test1234",
      role: "user",
    },
    {
      email: "ai@katalis.ai",
      name: "AI Agent",
      password: "ai-agent-password",
      role: "ai",
    },
  ];

  for (const userData of users) {
    await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash: await hashPassword(userData.password),
        role: userData.role,
      },
    });
  }

  // ── Seed Access Codes (existing) ────────────────────────────────────
  const code1 = await prisma.accessCode.create({
    data: {
      code: "KATAL-001",
      active: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const code2 = await prisma.accessCode.create({
    data: {
      code: "KATAL-002",
      active: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.accessCode.create({
    data: {
      code: "KATAL-EXP",
      active: true,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  // ── Seed Children + Gallery Data (existing) ─────────────────────────
  const child1 = await prisma.child.create({
    data: { accessCodeId: code1.id, locale: "id" },
  });

  const child2 = await prisma.child.create({
    data: { accessCodeId: code2.id, locale: "en" },
  });

  const disc1 = await prisma.discovery.create({
    data: {
      childId: child1.id,
      type: "artifact",
      fileUrl: "/api/storage/images/robot-drawing.jpg",
      detectedTalents: JSON.stringify([
        { name: "Engineering", confidence: 0.95, reasoning: "Detailed mechanical drawings" },
      ]),
    },
  });

  const disc2 = await prisma.discovery.create({
    data: {
      childId: child2.id,
      type: "story",
      detectedTalents: JSON.stringify([
        { name: "Narrative", confidence: 0.88, reasoning: "Compelling storytelling" },
      ]),
    },
  });

  const disc3 = await prisma.discovery.create({
    data: {
      childId: child1.id,
      type: "artifact",
      fileUrl: "/api/storage/images/painting.jpg",
      detectedTalents: JSON.stringify([
        { name: "Art", confidence: 0.92, reasoning: "Excellent use of color" },
      ]),
    },
  });

  const quest1 = await prisma.quest.create({
    data: {
      childId: child1.id,
      discoveryId: disc1.id,
      dream: "I want to build robots that help people",
      localContext: "I live in Jakarta near a river",
      status: "completed",
      generatedAt: new Date(),
    },
  });

  const quest2 = await prisma.quest.create({
    data: {
      childId: child2.id,
      discoveryId: disc2.id,
      dream: "I want to write stories that inspire",
      localContext: "I live in Tokyo, Japan",
      status: "completed",
      generatedAt: new Date(),
    },
  });

  const quest3 = await prisma.quest.create({
    data: {
      childId: child1.id,
      discoveryId: disc3.id,
      dream: "I want to paint murals in my village",
      localContext: "I live in Bali near the beach",
      status: "completed",
      generatedAt: new Date(),
    },
  });

  for (const quest of [quest1, quest2, quest3]) {
    for (let day = 1; day <= 7; day++) {
      await prisma.mission.create({
        data: {
          questId: quest.id,
          day,
          title: `Day ${day} Mission`,
          description: `Complete day ${day} challenge`,
          instructions: JSON.stringify([`Step 1 for day ${day}`, `Step 2 for day ${day}`]),
          materials: JSON.stringify(["Paper", "Pencil"]),
          tips: JSON.stringify(["Be creative!", "Take your time"]),
          status: "completed",
          proofPhotoUrl: `/api/storage/images/proof-${quest.id}-day-${day}.jpg`,
        },
      });
    }
  }

  const galleryEntriesData = [
    {
      childId: child1.id,
      questId: quest1.id,
      imageUrl: "/api/storage/images/proof-robot.jpg",
      talentCategory: "Engineering",
      country: "Indonesia",
      coordinates: JSON.stringify({ lat: -6.21, lng: 106.85 }),
      questContext: JSON.stringify({
        questTitle: "Robot Builder Quest",
        dream: "I want to build robots that help people",
        missionSummaries: ["Built a paper bridge", "Designed a robot arm", "Created a simple circuit"],
      }),
    },
    {
      childId: child2.id,
      questId: quest2.id,
      imageUrl: "/api/storage/images/proof-story.jpg",
      talentCategory: "Narrative",
      country: "Japan",
      coordinates: JSON.stringify({ lat: 36.2, lng: 138.3 }),
      questContext: JSON.stringify({
        questTitle: "Storyteller Quest",
        dream: "I want to write stories that inspire",
        missionSummaries: ["Wrote a short story", "Created a comic strip", "Recorded an audio story"],
      }),
    },
    {
      childId: child1.id,
      questId: quest3.id,
      imageUrl: "/api/storage/images/proof-art.jpg",
      talentCategory: "Art",
      country: "Indonesia",
      coordinates: JSON.stringify({ lat: -8.34, lng: 115.09 }),
      questContext: JSON.stringify({
        questTitle: "Mural Artist Quest",
        dream: "I want to paint murals in my village",
        missionSummaries: ["Sketched a mural design", "Mixed colors", "Painted a small mural"],
      }),
    },
  ];

  for (const entry of galleryEntriesData) {
    await prisma.galleryEntry.create({ data: entry });
  }

  console.log("Seed data created successfully:");
  console.log("");
  console.log("Users (development only):");
  console.log("  - admin@katalis.ai (admin)");
  console.log("  - test@katalis.ai (user)");
  console.log("  - ai@katalis.ai (ai)");
  console.log("");
  console.log("Access codes:");
  console.log("  - KATAL-001 (valid)");
  console.log("  - KATAL-002 (valid)");
  console.log("  - KATAL-EXP (expired)");
  console.log("");
  console.log("Gallery data:");
  console.log("  - 2 children with discoveries, quests, and gallery entries");
  console.log("  - 3 gallery entries (Engineering/Indonesia, Narrative/Japan, Art/Indonesia)");
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
