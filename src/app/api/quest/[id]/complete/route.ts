import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { geocodeLocationText } from "@/lib/geocoding";

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
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
      include: {
        missions: { orderBy: { day: "asc" } },
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

    // Handle skip gallery
    if ("skipGallery" in data && data.skipGallery) {
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
    const existingEntry = await prisma.galleryEntry.findUnique({
      where: { questId },
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
    const galleryEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.galleryEntry.create({
        data: {
          childId: session.childId,
          questId,
          imageUrl: selectedPhotoUrl!,
          talentCategory,
          country,
          coordinates,
          questContext,
        },
      });

      // Ensure quest status is completed
      await tx.quest.update({
        where: { id: questId },
        data: { status: "completed" },
      });

      return entry;
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

function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
