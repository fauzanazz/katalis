/**
 * Cross-area data flow tests.
 *
 * Covers VAL-CROSS-011 through VAL-CROSS-019, VAL-CROSS-039, VAL-CROSS-041, VAL-CROSS-045.
 *
 * Tests that data flows correctly between Discovery → Quest → Gallery,
 * including talent pre-population, no-quest-without-discovery enforcement,
 * gallery entry metadata integrity, geocoding, and file upload validation consistency.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock Drizzle db ---
const mockSelectCount = vi.fn();
const mockDiscoveriesFindFirst = vi.fn();
const mockQuestInsertValues = vi.fn();
const mockMissionsInsertValues = vi.fn();
const mockQuestsFindMany = vi.fn();
const mockQuestsFindFirst = vi.fn();
const mockGalleryEntriesFindFirst = vi.fn();
const mockTransaction = vi.fn();
const mockChildrenFindFirst = vi.fn();
const mockChildInterestProfilesFindMany = vi.fn();
const mockMissionsFindMany = vi.fn();

// Track insert call order to distinguish quests (1st call) vs missions (2nd call)
let insertCallIndex = 0;

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      children: {
        findFirst: (...args: unknown[]) => mockChildrenFindFirst(...args),
      },
      childInterestProfiles: {
        findMany: (...args: unknown[]) => mockChildInterestProfilesFindMany(...args),
      },
      discoveries: {
        findFirst: (...args: unknown[]) => mockDiscoveriesFindFirst(...args),
      },
      quests: {
        findMany: (...args: unknown[]) => mockQuestsFindMany(...args),
        findFirst: (...args: unknown[]) => mockQuestsFindFirst(...args),
      },
      galleryEntries: {
        findFirst: (...args: unknown[]) => mockGalleryEntriesFindFirst(...args),
      },
      missions: {
        findMany: (...args: unknown[]) => mockMissionsFindMany(...args),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => mockSelectCount(...args),
      })),
    })),
    insert: vi.fn(() => {
      // First insert call → quests, second → missions
      const idx = insertCallIndex++;
      return {
        values: idx === 0 ? mockQuestInsertValues : mockMissionsInsertValues,
      };
    }),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/lib/interests/quest-mapper", () => ({
  mapQuestToInterestSignals: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/interests/ingest-service", () => ({
  ingestInterestSignals: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock Auth ---
const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getChildSession: () => mockGetSession(),
}));

// --- Mock AI ---
vi.mock("@/lib/ai/client", () => ({
  generateQuest: vi.fn().mockResolvedValue({
    missions: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1} Mission`,
      description: `Description for day ${i + 1}`,
      instructions: [`Step 1 for day ${i + 1}`],
      materials: [`Material for day ${i + 1}`],
      tips: [`Tip for day ${i + 1}`],
    })),
  }),
}));

// --- Mock URL allowlist ---
vi.mock("@/lib/url-allowlist", () => ({
  isAllowedStorageUrl: () => true,
}));

vi.mock("@/lib/zpd", () => ({
  getZpdScore: vi.fn().mockResolvedValue(0.3),
  recordZpdEvent: vi.fn(),
  listSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/age", () => ({
  getAgeGroup: vi.fn().mockReturnValue({ band: "unknown", years: null }),
}));

vi.mock("@/lib/ai/quest/age-caps", () => ({
  clampOrRejectMissions: vi.fn().mockReturnValue({ ok: true }),
  buildAgeConstraintPromptFragment: vi.fn().mockReturnValue(""),
}));

vi.mock("@/lib/moderation", () => ({
  moderateContent: vi.fn().mockResolvedValue({
    allowed: true,
    status: "approved",
    confidence: 0.98,
    reasoning: "Content appears safe",
    eventId: "mod-1",
  }),
}));

// --- Import route handlers ---
import { POST as generateQuestPOST } from "@/app/api/quest/generate/route";
import { POST as completeQuestPOST } from "@/app/api/quest/[id]/complete/route";
import { NextRequest } from "next/server";

function makeRequest(
  body: Record<string, unknown>,
  opts: { method?: string; url?: string } = {},
) {
  return new NextRequest(
    new URL(opts.url ?? "http://localhost:3100/api/quest/generate"),
    {
      method: opts.method ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// Default insert chain for quests (returns quest row)
function setupQuestInsert(questRow: Record<string, unknown>) {
  const returning = vi.fn().mockResolvedValue([questRow]);
  mockQuestInsertValues.mockReturnValue({ returning });
}

// Default insert chain for missions (returns rows)
function setupMissionsInsert(missionRows: Array<Record<string, unknown>>) {
  const returning = vi.fn().mockResolvedValue(missionRows);
  mockMissionsInsertValues.mockReturnValue({ returning });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertCallIndex = 0;
  mockGetSession.mockResolvedValue({ childId: "child-1" });
  mockChildrenFindFirst.mockResolvedValue({ dateOfBirth: null });
  mockChildInterestProfilesFindMany.mockResolvedValue([]);
  mockDiscoveriesFindFirst.mockResolvedValue(null);
  mockQuestsFindMany.mockResolvedValue([]);
  mockMissionsFindMany.mockResolvedValue([]);
});

// =============================================================================
// VAL-CROSS-013: No Quest Generation Without Discovery
// =============================================================================
describe("VAL-CROSS-013: No quest without discovery", () => {
  it("rejects quest generation when child has no discoveries", async () => {
    mockSelectCount.mockResolvedValue([{ count: 0 }]);

    const req = makeRequest({
      dream: "I want to build robots that help people",
      localContext: "I live in a village near a river with farms",
    });

    const res = await generateQuestPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("no_discovery");
    expect(data.message).toContain("discovery");
  });

  it("allows quest generation when child has at least one discovery", async () => {
    mockSelectCount.mockResolvedValue([{ count: 1 }]);

    const questRow = {
      id: "quest-1",
      childId: "child-1",
      dream: "I want to build robots",
      localContext: "village",
      status: "active",
      discoveryId: "disc-1",
    };
    setupQuestInsert(questRow);

    const missionRows = Array.from({ length: 7 }, (_, i) => ({
      id: `mission-${i + 1}`,
      questId: "quest-1",
      day: i + 1,
      title: `Day ${i + 1} Mission`,
      description: `Description for day ${i + 1}`,
      instructions: JSON.stringify([`Step 1 for day ${i + 1}`]),
      materials: JSON.stringify([`Material for day ${i + 1}`]),
      tips: JSON.stringify([`Tip for day ${i + 1}`]),
      status: i === 0 ? "available" : "locked",
    }));
    setupMissionsInsert(missionRows);
    mockMissionsFindMany.mockResolvedValue(missionRows);

    const req = makeRequest({
      dream: "I want to build robots that help people",
      localContext: "I live in a village near a river with farms",
      talents: [
        { name: "Engineering", confidence: 0.9, reasoning: "Shows mechanical aptitude" },
      ],
      discoveryId: "disc-1",
    });

    const res = await generateQuestPOST(req);
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// VAL-CROSS-011: Talent Detection Feeds Quest Generation
// =============================================================================
describe("VAL-CROSS-011: Talent feeds quest generation", () => {
  it("passes talent data from discovery to quest generation", async () => {
    mockSelectCount.mockResolvedValue([{ count: 1 }]);

    const questRow = {
      id: "quest-1",
      childId: "child-1",
      dream: "I want to build robots",
      localContext: "Jakarta",
      status: "active",
      discoveryId: "disc-1",
    };
    setupQuestInsert(questRow);

    const missionRows = Array.from({ length: 7 }, (_, i) => ({
      id: `mission-${i + 1}`,
      questId: "quest-1",
      day: i + 1,
      title: `Day ${i + 1} Mission`,
      description: `Description for day ${i + 1}`,
      instructions: JSON.stringify([`Step 1 for day ${i + 1}`]),
      materials: JSON.stringify([`Material for day ${i + 1}`]),
      tips: JSON.stringify([`Tip for day ${i + 1}`]),
      status: i === 0 ? "available" : "locked",
    }));
    setupMissionsInsert(missionRows);
    mockMissionsFindMany.mockResolvedValue(missionRows);

    const talents = [
      {
        name: "Engineering/Mekanika",
        confidence: 0.92,
        reasoning: "Focus on mechanical joints and cables in robot drawing",
      },
    ];

    const req = makeRequest({
      dream: "I want to build robots",
      localContext: "I live in Jakarta, Indonesia",
      talents,
      discoveryId: "disc-1",
    });

    const res = await generateQuestPOST(req);
    expect(res.status).toBe(200);

    // Verify the quest was inserted with discoveryId
    expect(mockQuestInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        discoveryId: "disc-1",
        childId: "child-1",
      }),
    );
  });
});

// =============================================================================
// VAL-CROSS-017: Quest Completion Data Preserved in Gallery Entry
// VAL-CROSS-045: Quest Context Includes Local Context
// =============================================================================
describe("VAL-CROSS-017 / VAL-CROSS-045: Quest completion data in gallery entry", () => {
  const mockQuest = {
    id: "quest-1",
    childId: "child-1",
    dream: "I want to build robots",
    localContext: "I live in a village near a river in Indonesia",
    status: "active",
    discovery: {
      id: "disc-1",
      detectedTalents: JSON.stringify([
        { name: "Engineering/Mekanika", confidence: 0.92, reasoning: "Mechanical focus" },
      ]),
    },
    missions: Array.from({ length: 7 }, (_, i) => ({
      id: `mission-${i + 1}`,
      day: i + 1,
      title: `Day ${i + 1}: Build Robot Part ${i + 1}`,
      description: `Build part ${i + 1}`,
      status: "completed",
      proofPhotoUrl:
        i === 0
          ? "http://localhost:3100/api/storage/photo1.jpg"
          : `http://localhost:3100/api/storage/photo${i + 1}.jpg`,
    })),
  };

  it("creates gallery entry with correct talent category from discovery", async () => {
    mockQuestsFindFirst.mockResolvedValue(mockQuest);
    mockGalleryEntriesFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{
              id: "gallery-1",
              imageUrl: "http://localhost:3100/api/storage/photo1.jpg",
              talentCategory: "Engineering/Mekanika",
              country: "Indonesia",
              coordinates: JSON.stringify({ lat: -2.5, lng: 118.0 }),
              questContext: JSON.stringify({
                questTitle: "I want to build robots",
                dream: "I want to build robots",
                localContext: "I live in a village near a river in Indonesia",
                missionSummaries: mockQuest.missions.map((m) => m.title),
              }),
            }]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const req = new NextRequest(
      new URL("http://localhost:3100/api/quest/quest-1/complete"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg",
        }),
      },
    );

    const res = await completeQuestPOST(req, {
      params: Promise.resolve({ id: "quest-1" }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.galleryEntry.talentCategory).toBe("Engineering/Mekanika");

    const questContext = data.galleryEntry.questContext;
    expect(questContext).toBeDefined();
    expect(questContext.localContext).toBe(
      "I live in a village near a river in Indonesia",
    );
    expect(questContext.dream).toBe("I want to build robots");
    expect(questContext.missionSummaries).toHaveLength(7);
  });

  it("extracts highest-confidence talent as talentCategory", async () => {
    const questWithMultipleTalents = {
      ...mockQuest,
      discovery: {
        id: "disc-1",
        detectedTalents: JSON.stringify([
          { name: "Art", confidence: 0.6, reasoning: "Some artistic ability" },
          { name: "Engineering", confidence: 0.95, reasoning: "Strong mechanical focus" },
          { name: "Narrative", confidence: 0.7, reasoning: "Good storytelling" },
        ]),
      },
    };

    mockQuestsFindFirst.mockResolvedValue(questWithMultipleTalents);
    mockGalleryEntriesFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn().mockImplementation(({ talentCategory, ...rest }) => ({
            returning: vi.fn().mockResolvedValue([{
              id: "gallery-2",
              talentCategory,
              ...rest,
            }]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const req = new NextRequest(
      new URL("http://localhost:3100/api/quest/quest-1/complete"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg",
        }),
      },
    );

    const res = await completeQuestPOST(req, {
      params: Promise.resolve({ id: "quest-1" }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.galleryEntry.talentCategory).toBe("Engineering");
  });

  it("falls back to 'Creative' when no discovery attached to quest", async () => {
    const questNoDiscovery = {
      ...mockQuest,
      discovery: null,
    };

    mockQuestsFindFirst.mockResolvedValue(questNoDiscovery);
    mockGalleryEntriesFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn().mockImplementation((data) => ({
            returning: vi.fn().mockResolvedValue([{
              id: "gallery-3",
              ...data,
            }]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const req = new NextRequest(
      new URL("http://localhost:3100/api/quest/quest-1/complete"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg",
        }),
      },
    );

    const res = await completeQuestPOST(req, {
      params: Promise.resolve({ id: "quest-1" }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.galleryEntry.talentCategory).toBe("Creative");
  });
});

// =============================================================================
// VAL-CROSS-016: Incomplete Quest Cannot Submit to Gallery
// =============================================================================
describe("VAL-CROSS-016: Incomplete quest blocked from gallery", () => {
  it("rejects gallery submission when not all missions are completed", async () => {
    const incompleteQuest = {
      id: "quest-1",
      childId: "child-1",
      dream: "I want to build robots",
      localContext: "I live in Indonesia",
      status: "active",
      discovery: null,
      missions: [
        { id: "m1", day: 1, title: "Day 1", status: "completed", proofPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg" },
        { id: "m2", day: 2, title: "Day 2", status: "completed", proofPhotoUrl: "http://localhost:3100/api/storage/photo2.jpg" },
        { id: "m3", day: 3, title: "Day 3", status: "completed", proofPhotoUrl: "http://localhost:3100/api/storage/photo3.jpg" },
        { id: "m4", day: 4, title: "Day 4", status: "in_progress", proofPhotoUrl: null },
        { id: "m5", day: 5, title: "Day 5", status: "locked", proofPhotoUrl: null },
        { id: "m6", day: 6, title: "Day 6", status: "locked", proofPhotoUrl: null },
        { id: "m7", day: 7, title: "Day 7", status: "locked", proofPhotoUrl: null },
      ],
    };

    mockQuestsFindFirst.mockResolvedValue(incompleteQuest);

    const req = new NextRequest(
      new URL("http://localhost:3100/api/quest/quest-1/complete"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg",
        }),
      },
    );

    const res = await completeQuestPOST(req, {
      params: Promise.resolve({ id: "quest-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("incomplete_quest");
  });
});

// =============================================================================
// VAL-CROSS-041: Gallery Entry Reflects Correct Geographic Context
// =============================================================================
describe("VAL-CROSS-041: Gallery entry geocoding", () => {
  it("geocodes Indonesian local context to correct coordinates", async () => {
    const questIndonesia = {
      id: "quest-1",
      childId: "child-1",
      dream: "I want to be a scientist",
      localContext: "Saya tinggal di desa dekat sungai di Yogyakarta",
      status: "active",
      discovery: {
        id: "disc-1",
        detectedTalents: JSON.stringify([
          { name: "Science", confidence: 0.85, reasoning: "Curious about nature" },
        ]),
      },
      missions: Array.from({ length: 7 }, (_, i) => ({
        id: `m-${i + 1}`,
        day: i + 1,
        title: `Day ${i + 1}`,
        status: "completed",
        proofPhotoUrl: `http://localhost:3100/api/storage/photo${i + 1}.jpg`,
      })),
    };

    mockQuestsFindFirst.mockResolvedValue(questIndonesia);
    mockGalleryEntriesFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn().mockImplementation((data) => ({
            returning: vi.fn().mockResolvedValue([{
              id: "gallery-geo",
              ...data,
            }]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      return fn(tx);
    });

    const req = new NextRequest(
      new URL("http://localhost:3100/api/quest/quest-1/complete"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg",
        }),
      },
    );

    const res = await completeQuestPOST(req, {
      params: Promise.resolve({ id: "quest-1" }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.galleryEntry.country).toBe("Indonesia");
    expect(data.galleryEntry.coordinates).toBeDefined();
    expect(data.galleryEntry.coordinates.lat).toBeCloseTo(-7.80, 0);
    expect(data.galleryEntry.coordinates.lng).toBeCloseTo(110.36, 0);
  });
});

// =============================================================================
// VAL-CROSS-039: File Upload Validation Consistency Across Areas
// =============================================================================
describe("VAL-CROSS-039: File upload validation consistency", () => {
  it("uses the same validation constants for all areas", async () => {
    const {
      ACCEPTED_IMAGE_TYPES,
      ACCEPTED_AUDIO_TYPES,
      MAX_IMAGE_SIZE_BYTES,
      MAX_AUDIO_SIZE_BYTES,
      validateFile,
    } = await import("@/lib/storage/validation");

    expect(ACCEPTED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/png");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/webp");
    expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);

    expect(ACCEPTED_AUDIO_TYPES).toContain("audio/mpeg");
    expect(ACCEPTED_AUDIO_TYPES).toContain("audio/wav");
    expect(MAX_AUDIO_SIZE_BYTES).toBe(5 * 1024 * 1024);

    expect(validateFile("image/jpeg", 1024, "image").valid).toBe(true);
    expect(validateFile("image/gif", 1024, "image").valid).toBe(false);
    expect(validateFile("audio/mpeg", 1024, "audio").valid).toBe(true);
    expect(validateFile("audio/ogg", 1024, "audio").valid).toBe(false);
  });

  it("rejects oversized files consistently across areas", async () => {
    const { validateFile, MAX_IMAGE_SIZE_BYTES } =
      await import("@/lib/storage/validation");

    const oversizeResult = validateFile(
      "image/jpeg",
      MAX_IMAGE_SIZE_BYTES + 1,
      "image",
    );
    expect(oversizeResult.valid).toBe(false);
    expect(oversizeResult.error).toContain("too large");
  });
});

// =============================================================================
// VAL-CROSS-012: Story Prompting Result Feeds Quest Generation (same as artifact)
// =============================================================================
describe("VAL-CROSS-012: Story prompting result feeds quest generation", () => {
  it("accepts story-based talents for quest generation", async () => {
    mockSelectCount.mockResolvedValue([{ count: 1 }]);

    const questRow = {
      id: "quest-story",
      childId: "child-1",
      dream: "I want to write amazing stories for children",
      localContext: "I live in a city with a big library in Japan",
      status: "active",
      discoveryId: "disc-story-1",
    };
    setupQuestInsert(questRow);

    const missionRows = Array.from({ length: 7 }, (_, i) => ({
      id: `m-${i + 1}`,
      questId: "quest-story",
      day: i + 1,
      title: `Day ${i + 1} Story Mission`,
      description: `Story mission day ${i + 1}`,
      instructions: JSON.stringify([`Step ${i + 1}`]),
      materials: JSON.stringify([`Item ${i + 1}`]),
      tips: JSON.stringify([`Tip ${i + 1}`]),
      status: i === 0 ? "available" : "locked",
    }));
    setupMissionsInsert(missionRows);
    mockMissionsFindMany.mockResolvedValue(missionRows);

    const storyTalents = [
      {
        name: "Narrative/Storytelling",
        confidence: 0.88,
        reasoning: "Shows strong narrative structure and emotional depth",
      },
      {
        name: "Empathy",
        confidence: 0.75,
        reasoning: "Characters show deep emotional understanding",
      },
    ];

    const req = makeRequest({
      dream: "I want to write amazing stories for children",
      localContext: "I live in a city with a big library in Japan",
      talents: storyTalents,
      discoveryId: "disc-story-1",
    });

    const res = await generateQuestPOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe("quest-story");
    expect(data.missions).toHaveLength(7);

    expect(mockQuestInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        discoveryId: "disc-story-1",
      }),
    );
  });
});

// =============================================================================
// VAL-CROSS-015: Completed Quest Work Feeds Gallery Submission
// =============================================================================
describe("VAL-CROSS-015: Quest→Gallery submission flow", () => {
  it("prevents duplicate gallery entries for the same quest", async () => {
    const completedQuest = {
      id: "quest-dup",
      childId: "child-1",
      dream: "Build things",
      localContext: "Indonesia",
      status: "active",
      discovery: {
        id: "disc-1",
        detectedTalents: JSON.stringify([
          { name: "Engineering", confidence: 0.9, reasoning: "test" },
        ]),
      },
      missions: Array.from({ length: 7 }, (_, i) => ({
        id: `m-${i + 1}`,
        day: i + 1,
        title: `Day ${i + 1}`,
        status: "completed",
        proofPhotoUrl: `http://localhost:3100/api/storage/photo${i + 1}.jpg`,
      })),
    };

    mockQuestsFindFirst.mockResolvedValue(completedQuest);
    mockGalleryEntriesFindFirst.mockResolvedValue({
      id: "existing-gallery",
      questId: "quest-dup",
    });

    const req = new NextRequest(
      new URL("http://localhost:3100/api/quest/quest-dup/complete"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPhotoUrl: "http://localhost:3100/api/storage/photo1.jpg",
        }),
      },
    );

    const res = await completeQuestPOST(req, {
      params: Promise.resolve({ id: "quest-dup" }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("duplicate_entry");
  });
});
