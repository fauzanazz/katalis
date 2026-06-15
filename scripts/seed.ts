/**
 * Drizzle seed script — port of prisma/seed.ts.
 * Run: bun scripts/seed.ts
 * Run against prod: bun --env-file=.env.production.local scripts/seed.ts
 */
import { eq, and } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  users,
  accessCodes,
  children,
  discoveries,
  quests,
  missions,
  galleryEntries,
  squads,
  squadMembers,
  parentChildren,
  interestSignals,
  childInterestProfiles,
  missionInterestAssessments,
  interestAuditEvents,
  parentReports,
  rateLimits,
  moderationEvents,
  mentorMessages,
  mentorSessions,
  childBadges,
  adjustmentEvents,
  reflectionEntries,
} from "../src/lib/schema";
import { hashPassword } from "../src/lib/password";

async function main() {
  // ── Clean existing data (reverse FK order) ──────────────────────────────────
  await db.delete(interestAuditEvents);
  await db.delete(missionInterestAssessments);
  await db.delete(childInterestProfiles);
  await db.delete(interestSignals);
  await db.delete(parentReports);
  await db.delete(parentChildren);
  await db.delete(squadMembers);
  await db.delete(squads);
  await db.delete(moderationEvents);
  await db.delete(reflectionEntries);
  await db.delete(childBadges);
  await db.delete(adjustmentEvents);
  await db.delete(mentorMessages);
  await db.delete(mentorSessions);
  await db.delete(galleryEntries);
  await db.delete(missions);
  await db.delete(quests);
  await db.delete(discoveries);
  await db.delete(children);
  await db.delete(accessCodes);
  await db.delete(users);
  await db.delete(rateLimits);

  // ── Seed Users ──────────────────────────────────────────────────────────────
  const usersData = [
    { email: "admin@katalis.ai", name: "Admin", password: "admin123", role: "admin" },
    { email: "test@katalis.ai", name: "Test User", password: "test1234", role: "user" },
    { email: "ai@katalis.ai", name: "AI Agent", password: "ai-agent-password", role: "ai" },
  ];

  for (const userData of usersData) {
    await db.insert(users).values({
      email: userData.email,
      name: userData.name,
      passwordHash: await hashPassword(userData.password),
      role: userData.role,
    });
  }

  // ── Seed Access Codes ────────────────────────────────────────────────────────
  const [code1] = await db
    .insert(accessCodes)
    .values({
      code: "KATAL-001",
      active: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .returning();

  const [code2] = await db
    .insert(accessCodes)
    .values({
      code: "KATAL-002",
      active: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .returning();

  await db.insert(accessCodes).values({
    code: "KATAL-EXP",
    active: true,
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  // ── Seed Children ───────────────────────────────────────────────────────────
  const [child1] = await db
    .insert(children)
    .values({ accessCodeId: code1.id, locale: "id" })
    .returning();

  const [child2] = await db
    .insert(children)
    .values({ accessCodeId: code2.id, locale: "en" })
    .returning();

  // ── Seed Discoveries ─────────────────────────────────────────────────────────
  const [disc1] = await db
    .insert(discoveries)
    .values({
      childId: child1.id,
      type: "artifact",
      fileUrl: "/api/storage/images/robot-drawing.jpg",
      detectedTalents: JSON.stringify([
        { name: "Engineering", confidence: 0.95, reasoning: "Detailed mechanical drawings" },
      ]),
    })
    .returning();

  const [disc2] = await db
    .insert(discoveries)
    .values({
      childId: child2.id,
      type: "story",
      detectedTalents: JSON.stringify([
        { name: "Narrative", confidence: 0.88, reasoning: "Compelling storytelling" },
      ]),
    })
    .returning();

  const [disc3] = await db
    .insert(discoveries)
    .values({
      childId: child1.id,
      type: "artifact",
      fileUrl: "/api/storage/images/painting.jpg",
      detectedTalents: JSON.stringify([
        { name: "Art", confidence: 0.92, reasoning: "Excellent use of color" },
      ]),
    })
    .returning();

  // ── Seed Quests ─────────────────────────────────────────────────────────────
  const [quest1] = await db
    .insert(quests)
    .values({
      childId: child1.id,
      discoveryId: disc1.id,
      dream: "I want to build robots that help people",
      localContext: "I live in Jakarta near a river",
      status: "completed",
      generatedAt: new Date(),
    })
    .returning();

  const [quest2] = await db
    .insert(quests)
    .values({
      childId: child2.id,
      discoveryId: disc2.id,
      dream: "I want to write stories that inspire",
      localContext: "I live in Tokyo, Japan",
      status: "completed",
      generatedAt: new Date(),
    })
    .returning();

  const [quest3] = await db
    .insert(quests)
    .values({
      childId: child1.id,
      discoveryId: disc3.id,
      dream: "I want to paint murals in my village",
      localContext: "I live in Bali near the beach",
      status: "completed",
      generatedAt: new Date(),
    })
    .returning();

  // ── Seed Missions (7 per quest) ─────────────────────────────────────────────
  for (const quest of [quest1, quest2, quest3]) {
    for (let day = 1; day <= 7; day++) {
      await db.insert(missions).values({
        questId: quest.id,
        day,
        title: `Day ${day} Mission`,
        description: `Complete day ${day} challenge`,
        instructions: JSON.stringify([`Step 1 for day ${day}`, `Step 2 for day ${day}`]),
        materials: JSON.stringify(["Paper", "Pencil"]),
        tips: JSON.stringify(["Be creative!", "Take your time"]),
        status: "completed",
        proofPhotoUrl: `/api/storage/images/proof-${quest.id}-day-${day}.jpg`,
      });
    }
  }

  // ── Seed Gallery Entries ──────────────────────────────────────────────────────
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

  const createdGalleryEntries: { id: string }[] = [];
  for (const entry of galleryEntriesData) {
    const [created] = await db.insert(galleryEntries).values(entry).returning({ id: galleryEntries.id });
    createdGalleryEntries.push(created);
  }

  // ── Seed Squads ──────────────────────────────────────────────────────────────
  const [squad1] = await db
    .insert(squads)
    .values({
      name: "Robot Builders from Asia",
      theme: "Engineering",
      description: "Young engineers from Asia building amazing machines and solving real-world problems!",
      icon: "🤖",
      countries: JSON.stringify(["Indonesia"]),
      featuredEntryIds: JSON.stringify([createdGalleryEntries[0].id]),
      status: "active",
    })
    .returning();

  const [squad2] = await db
    .insert(squads)
    .values({
      name: "Story Tellers from Asia",
      theme: "Narrative",
      description: "Creative storytellers from Asia sharing wonderful stories and imagination!",
      icon: "📖",
      countries: JSON.stringify(["Japan"]),
      featuredEntryIds: JSON.stringify([createdGalleryEntries[1].id]),
      status: "active",
    })
    .returning();

  const [squad3] = await db
    .insert(squads)
    .values({
      name: "Young Artists from Indonesia",
      theme: "Art",
      description: "Talented young artists from Indonesia creating beautiful artwork!",
      icon: "🎨",
      countries: JSON.stringify(["Indonesia"]),
      featuredEntryIds: JSON.stringify([createdGalleryEntries[2].id]),
      status: "active",
    })
    .returning();

  // ── Seed Squad Members ───────────────────────────────────────────────────────
  await db.insert(squadMembers).values([
    { squadId: squad1.id, childId: child1.id },
    { squadId: squad2.id, childId: child2.id },
    { squadId: squad3.id, childId: child1.id },
  ]);

  // ── Seed Parent-Child Links ──────────────────────────────────────────────────
  const testUser = await db.query.users.findFirst({
    where: eq(users.email, "test@katalis.ai"),
  });

  if (testUser) {
    await db.insert(parentChildren).values({ userId: testUser.id, childId: child1.id });
  }

  // ── Seed Longitudinal Interest Tracking ─────────────────────────────────────
  await db.insert(interestSignals).values([
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
  ]);

  await db.insert(childInterestProfiles).values([
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
  ]);

  const firstRobotMission = await db.query.missions.findFirst({
    where: and(eq(missions.questId, quest1.id), eq(missions.day, 1)),
  });

  if (firstRobotMission) {
    await db.insert(missionInterestAssessments).values({
      childId: child1.id,
      missionId: firstRobotMission.id,
      taxonomyVersion: "v1",
      interestKey: "technology",
      explicitRating: 5,
      parentRating: 5,
      observedEngagement: 5,
      notes: "Seed parent rating: child asked to repeat the robot activity.",
    });
  }

  await db.insert(interestAuditEvents).values({
    childId: child1.id,
    actorUserId: testUser?.id ?? null,
    eventType: "seed_longitudinal_interest_data",
    entityType: "interest_profile",
    metadataJson: JSON.stringify({ profileCount: 2, signalCount: 3 }),
  });

  // ── Seed Parent Report ───────────────────────────────────────────────────────
  if (testUser) {
    await db.insert(parentReports).values({
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
      summary:
        "Your child showed impressive engineering creativity this week! They completed all 7 missions of their robot-building quest, demonstrating strong problem-solving and design thinking. Encourage them to keep building and exploring how things work.",
      badgeHighlights: JSON.stringify(["first_step", "week_warrior"]),
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

main().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
