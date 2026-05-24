import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { getChildSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { quests, missions, galleryEntries } from "@/lib/schema";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { geocodeLocationText } from "@/lib/geocoding";
import { mapQuestToInterestSignals } from "@/lib/interests/quest-mapper";
import { ingestInterestSignals } from "@/lib/interests/ingest-service";

/**
 * Zod schema for quest completion requests.
 *
 * Either provide `selectedPhotoUrl` (to submit to gallery)
 * or set `skipGallery: true` (to skip gallery submission).
 */
const QuestCompleteSchema = z.union([
  z.object({
    selectedPhotoUrl: z.string().url(),
    skipGallery: z.literal(false).optional(),
  }),
  z.object({
    skipGallery: z.literal(true),
  }),
]);

/**
 * POST /api/quest/[id]/complete
 *
 * Completes a quest and optionally creates a GalleryEntry.
 * Validates that all 7 missions are completed before accepting.
 *
 * Body options:
 * - { selectedPhotoUrl: string } — creates a gallery entry with the selected best work
 * - { skipGallery: true } — skips gallery submission, still marks quest completion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getChildSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const { id: questId } = await params;

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = QuestCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message:
            parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    // Fetch the quest with missions and discovery
    const quest = await db.query.quests.findFirst({
      where: eq(quests.id, questId),
      with: {
        missions: { orderBy: asc(missions.day) },
        discovery: true,
      },
    });

    if (!quest) {
      return NextResponse.json(
        { error: "not_found", message: "Quest not found" },
        { status: 404 },
      );
    }

    // Verify ownership
    if (quest.childId !== session.childId) {
      return NextResponse.json(
        { error: "forbidden", message: "Access denied" },
        { status: 403 },
      );
    }

    // Verify all missions are completed
    const allCompleted = quest.missions.every(
      (m) => m.status === "completed",
    );
    if (!allCompleted) {
      return NextResponse.json(
        {
          error: "incomplete_quest",
          message:
            "All 7 missions must be completed before quest completion.",
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Sanitize URL input unconditionally (XSS prevention + URL origin check)
    if ("selectedPhotoUrl" in data && data.selectedPhotoUrl) {
      const sanitized = sanitizeInput(data.selectedPhotoUrl);
      if (!isAllowedStorageUrl(sanitized)) {
        return NextResponse.json(
          {
            error: "invalid",
            message: "Invalid photo URL origin",
          },
          { status: 400 },
        );
      }
      // Replace with sanitized value
      (data as { selectedPhotoUrl: string }).selectedPhotoUrl = sanitized;
    }

    // Handle skip gallery — still marks quest completed and ingests signals
    if ("skipGallery" in data && data.skipGallery) {
      await db.update(quests).set({ status: "completed" }).where(eq(quests.id, questId));

      await runQuestCompletedSignals({
        childId: session.childId,
        questId,
        dream: quest.dream,
        localContext: quest.localContext,
        detectedTalents: quest.discovery?.detectedTalents
          ? safeParseJSON<Array<{ name: string; confidence: number }>>(
              quest.discovery.detectedTalents,
              [],
            )
          : [],
      });

      return NextResponse.json({
        success: true,
        galleryEntry: null,
        skipped: true,
      });
    }

    // Validate selectedPhotoUrl is from this quest's missions
    const selectedPhotoUrl =
      "selectedPhotoUrl" in data ? data.selectedPhotoUrl : undefined;

    if (selectedPhotoUrl) {
      const validPhotoUrls = quest.missions
        .filter((m) => m.proofPhotoUrl)
        .map((m) => m.proofPhotoUrl);

      if (!validPhotoUrls.includes(selectedPhotoUrl)) {
        return NextResponse.json(
          {
            error: "invalid_photo",
            message:
              "Selected photo must be from one of the quest's completed missions.",
          },
          { status: 400 },
        );
      }
    }

    // Check for duplicate gallery entry
    const existingEntry = await db.query.galleryEntries.findFirst({
      where: eq(galleryEntries.questId, questId),
    });

    if (existingEntry) {
      return NextResponse.json(
        {
          error: "duplicate_entry",
          message:
            "A gallery entry already exists for this quest.",
        },
        { status: 409 },
      );
    }

    // Extract talent category from discovery
    const detectedTalents = quest.discovery?.detectedTalents
      ? safeParseJSON<Array<{ name: string; confidence: number }>>(
          quest.discovery.detectedTalents,
          [],
        )
      : [];

    // Use highest-confidence talent or fallback
    const sortedTalents = [...detectedTalents].sort(
      (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
    );
    const talentCategory = sortedTalents[0]?.name ?? "Creative";

    // Geocode location from local context
    const geoResult = geocodeLocationText(quest.localContext);
    const country = geoResult?.country ?? null;
    const coordinates = geoResult?.coordinates
      ? JSON.stringify(geoResult.coordinates)
      : null;

    // Build quest context metadata (includes localContext for gallery display)
    const questContext = JSON.stringify({
      questTitle: quest.dream,
      dream: quest.dream,
      localContext: quest.localContext,
      missionSummaries: quest.missions.map((m) => m.title),
    });

    // Create gallery entry in a transaction
    const galleryEntry = await db.transaction(async (tx) => {
      const [entry] = await tx.insert(galleryEntries).values({
        childId: session.childId,
        questId,
        imageUrl: selectedPhotoUrl!,
        talentCategory,
        country,
        coordinates,
        questContext,
      }).returning();

      // Ensure quest status is completed
      await tx.update(quests).set({ status: "completed" }).where(eq(quests.id, questId));

      return entry;
    });

    // Ingest quest-completed interest signals (fire-and-forget)
    await runQuestCompletedSignals({
      childId: session.childId,
      questId,
      dream: quest.dream,
      localContext: quest.localContext,
      detectedTalents,
    });

    return NextResponse.json({
      success: true,
      galleryEntry: {
        id: galleryEntry.id,
        imageUrl: galleryEntry.imageUrl,
        talentCategory: galleryEntry.talentCategory,
        country: galleryEntry.country,
        coordinates: safeParseJSON(galleryEntry.coordinates, null),
        questContext: safeParseJSON(galleryEntry.questContext, null),
      },
    });
  } catch (error) {
    console.error("Quest completion error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to complete quest" },
      { status: 500 },
    );
  }
}

async function runQuestCompletedSignals({
  childId,
  questId,
  dream,
  localContext,
  detectedTalents,
}: {
  childId: string;
  questId: string;
  dream: string;
  localContext: string;
  detectedTalents: Array<{ name: string; confidence: number }>;
}): Promise<void> {
  try {
    const completionSignals = mapQuestToInterestSignals({
      dream,
      localContext,
      detectedTalents,
    });
    const persistenceSignals = completionSignals.map((s) => ({
      ...s,
      dimension: "persistence" as const,
      strength: 0.7,
      confidence: 0.75,
    }));
    if (persistenceSignals.length > 0) {
      await ingestInterestSignals({
        childId,
        source: "quest_completed",
        questId,
        signals: persistenceSignals,
      });
    }
  } catch (interestError) {
    console.error("Interest ingestion failed for quest completion, continuing:", interestError);
  }
}

function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
