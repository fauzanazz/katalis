import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  // Clean existing data
  await prisma.interestAuditEvent.deleteMany();
  await prisma.missionInterestAssessment.deleteMany();
  await prisma.childInterestProfile.deleteMany();
  await prisma.interestSignal.deleteMany();
  await prisma.parentReport.deleteMany();
  await prisma.parentChild.deleteMany();
  await prisma.squadMember.deleteMany();
  await prisma.squad.deleteMany();
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

  const galleryEntries: { id: string }[] = [];
  for (const entry of galleryEntriesData) {
    const created = await prisma.galleryEntry.create({ data: entry });
    galleryEntries.push(created);
  }

  // ── Seed Squads ──────────────────────────────────────────────────────
  const squad1 = await prisma.squad.create({
    data: {
      name: "Robot Builders from Asia",
      theme: "Engineering",
      description: "Young engineers from Asia building amazing machines and solving real-world problems!",
      icon: "🤖",
      countries: JSON.stringify(["Indonesia"]),
      featuredEntryIds: JSON.stringify([galleryEntries[0].id]),
      status: "active",
    },
  });

  const squad2 = await prisma.squad.create({
    data: {
      name: "Story Tellers from Asia",
      theme: "Narrative",
      description: "Creative storytellers from Asia sharing wonderful stories and imagination!",
      icon: "📖",
      countries: JSON.stringify(["Japan"]),
      featuredEntryIds: JSON.stringify([galleryEntries[1].id]),
      status: "active",
    },
  });

  const squad3 = await prisma.squad.create({
    data: {
      name: "Young Artists from Indonesia",
      theme: "Art",
      description: "Talented young artists from Indonesia creating beautiful artwork!",
      icon: "🎨",
      countries: JSON.stringify(["Indonesia"]),
      featuredEntryIds: JSON.stringify([galleryEntries[2].id]),
      status: "active",
    },
  });

  // ── Seed Squad Members ──────────────────────────────────────────────
  await prisma.squadMember.createMany({
    data: [
      { squadId: squad1.id, childId: child1.id },
      { squadId: squad2.id, childId: child2.id },
      { squadId: squad3.id, childId: child1.id },
    ],
  });

  // ── Seed Parent-Child Links ──────────────────────────────────────────
  const testUser = await prisma.user.findUnique({ where: { email: "test@katalis.ai" } });
  if (testUser) {
    await prisma.parentChild.create({
      data: { userId: testUser.id, childId: child1.id },
    });
  }

  // ── Seed Longitudinal Interest Tracking ──────────────────────────────
  const firstRobotMission = await prisma.mission.findFirst({
    where: { questId: quest1.id, day: 1 },
  });

  await prisma.interestSignal.createMany({
    data: [
      {
        childId: child1.id,
        taxonomyVersion: "v1",
        interestKey: "technology",
        source: "discovery_analysis",
        dimension: "curiosity",
        strength: 0.9,
        confidence: 0.95,
        discoveryId: disc1.id,
        metadataJson: JSON.stringify({ talentName: "Engineering", seed: true }),
      },
      {
        childId: child1.id,
        taxonomyVersion: "v1",
        interestKey: "technology",
        source: "quest_completed",
        dimension: "persistence",
        strength: 0.7,
        confidence: 0.75,
        questId: quest1.id,
        metadataJson: JSON.stringify({ dream: quest1.dream, seed: true }),
      },
      {
        childId: child1.id,
        taxonomyVersion: "v1",
        interestKey: "art",
        source: "discovery_analysis",
        dimension: "joy",
        strength: 0.8,
        confidence: 0.92,
        discoveryId: disc3.id,
        metadataJson: JSON.stringify({ talentName: "Art", seed: true }),
      },
    ],
  });

  await prisma.childInterestProfile.createMany({
    data: [
      {
        childId: child1.id,
        taxonomyVersion: "v1",
        interestKey: "technology",
        score: 1,
        confidence: 0.85,
        signalCount: 2,
        lastSignalAt: new Date(),
        trend: "rising",
        summary: "Shows sustained interest in building helpful machines.",
      },
      {
        childId: child1.id,
        taxonomyVersion: "v1",
        interestKey: "art",
        score: 0.74,
        confidence: 0.72,
        signalCount: 1,
        lastSignalAt: new Date(),
        trend: "stable",
        summary: "Visual art appears as an emerging adjacent interest.",
      },
    ],
  });

  if (firstRobotMission) {
    await prisma.missionInterestAssessment.create({
      data: {
        childId: child1.id,
        missionId: firstRobotMission.id,
        taxonomyVersion: "v1",
        interestKey: "technology",
        explicitRating: 5,
        parentRating: 5,
        observedEngagement: 5,
        notes: "Seed parent rating: child asked to repeat the robot activity.",
      },
    });
  }

  await prisma.interestAuditEvent.create({
    data: {
      childId: child1.id,
      actorUserId: testUser?.id,
      eventType: "seed_longitudinal_interest_data",
      entityType: "interest_profile",
      metadataJson: JSON.stringify({ profileCount: 2, signalCount: 3 }),
    },
  });

  // ── Seed Parent Report ──────────────────────────────────────────────
  if (testUser) {
    await prisma.parentReport.create({
      data: {
        parentId: testUser.id,
        childId: child1.id,
        type: "weekly",
        period: JSON.stringify({
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        }),
        strengths: JSON.stringify([
          "Strong engineering aptitude demonstrated through robot building",
          "Excellent problem-solving skills in hands-on projects",
          "Creative approach to mechanical design",
        ]),
        growthAreas: JSON.stringify([
          "Try combining engineering with storytelling to explain designs",
          "Explore more complex mechanisms with guidance",
        ]),
        tips: JSON.stringify([
          {
            title: "Build a Cardboard Bridge",
            description: "Use household cardboard and tape to build a bridge that holds a toy car. Discuss what makes it strong.",
            materials: ["Cardboard", "Tape", "Toy car"],
            category: "Engineering",
          },
          {
            title: "Draw Your Dream Machine",
            description: "Ask your child to sketch a machine that helps people. Encourage labeling the parts.",
            materials: ["Paper", "Pencil", "Crayons"],
            category: "Engineering",
          },
        ]),
        summary: "Your child showed impressive engineering creativity this week! They completed all 7 missions of their robot-building quest, demonstrating strong problem-solving and design thinking. Encourage them to keep building and exploring how things work.",
        badgeHighlights: JSON.stringify(["first_step", "week_warrior"]),
      },
    });
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
  console.log("");
  console.log("Squad & Parent data:");
  console.log("  - 3 squads (Engineering, Narrative, Art)");
  console.log("  - 3 squad members");
  console.log("  - 1 parent-child link (test@katalis.ai → child1)");
  console.log("  - 1 sample parent report");
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
