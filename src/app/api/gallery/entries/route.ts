import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { geocodeLocationText } from "@/lib/geocoding";

/**
 * Zod schema for creating a gallery entry.
 *
 * `questId` is required. `selectedPhotoUrl` is optional — if omitted,
 * the first mission's proof photo is used.
 */
const CreateGalleryEntrySchema = z.object({
  questId: z.string().min(1, "Quest ID is required"),
  selectedPhotoUrl: z.string().url().optional(),
});

/**
 * GET /api/gallery/entries
 *
 * Retrieves gallery entries with pagination. Publicly accessible (no auth required).
 * Strips childId from response for privacy.
 *
 * Query params:
 * - page (default: 1)
 * - pageSize (default: 20, max: 100)
 * - talentCategory (optional filter)
 */
export async function GET(request: NextRequest | Request) {
  try {
    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(
      url.searchParams.get("pageSize") || "20",
      10,
    );
    const talentCategory = url.searchParams.get("talentCategory");

    // Clamp values
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.min(100, Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam));
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (talentCategory) {
      where.talentCategory = talentCategory;
    }

    const [entries, total] = await Promise.all([
      prisma.galleryEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.galleryEntry.count({ where }),
    ]);

    // Map entries to remove childId (privacy) and parse JSON fields
    const sanitizedEntries = entries.map((entry) => ({
      id: entry.id,
      questId: entry.questId,
      imageUrl: entry.imageUrl,
      talentCategory: entry.talentCategory,
      country: entry.country,
      coordinates: safeParseJSON(entry.coordinates, null),
      questContext: safeParseJSON(entry.questContext, null),
      clusterGroup: entry.clusterGroup,
      createdAt: entry.createdAt,
    }));

    return NextResponse.json({
      entries: sanitizedEntries,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Gallery entries fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch gallery entries" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/gallery/entries
 *
 * Creates a gallery entry from a completed quest. Requires authentication.
 * Automatically geocodes location from quest's localContext.
 * Builds questContext from quest metadata (dream, mission summaries).
 * Prevents duplicate entries per quest.
 *
 * Body:
 * - questId: string (required)
 * - selectedPhotoUrl: string (optional, defaults to first mission photo)
 */
export async function POST(request: NextRequest | Request) {
  try {
    const session = await getSession();
    if (!session?.childId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = CreateGalleryEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { questId, selectedPhotoUrl: rawPhotoUrl } = parsed.data;

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
            "All 7 missions must be completed before creating a gallery entry.",
        },
        { status: 400 },
      );
    }

    // Sanitize URL input and validate origin
    let photoUrl = rawPhotoUrl;
    if (photoUrl) {
      photoUrl = sanitizeInput(photoUrl);
      if (!isAllowedStorageUrl(photoUrl)) {
        return NextResponse.json(
          { error: "invalid", message: "Invalid photo URL origin" },
          { status: 400 },
        );
      }
    } else {
      // Default to first completed mission's proof photo
      const firstProof = quest.missions.find((m) => m.proofPhotoUrl);
      photoUrl = firstProof?.proofPhotoUrl ?? undefined;
    }

    if (!photoUrl) {
      return NextResponse.json(
        { error: "invalid", message: "No photo available for gallery entry" },
        { status: 400 },
      );
    }

    // Validate photo is from this quest's missions
    if (rawPhotoUrl) {
      const validPhotoUrls = quest.missions
        .filter((m) => m.proofPhotoUrl)
        .map((m) => m.proofPhotoUrl);
      if (!validPhotoUrls.includes(photoUrl)) {
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
          message: "A gallery entry already exists for this quest.",
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

    // Build quest context
    const questContext = JSON.stringify({
      questTitle: quest.dream,
      dream: quest.dream,
      missionSummaries: quest.missions.map((m) => m.title),
    });

    // Create gallery entry in a transaction
    const galleryEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.galleryEntry.create({
        data: {
          childId: session.childId,
          questId,
          imageUrl: photoUrl!,
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

    return NextResponse.json(
      {
        success: true,
        galleryEntry: {
          id: galleryEntry.id,
          questId: galleryEntry.questId,
          imageUrl: galleryEntry.imageUrl,
          talentCategory: galleryEntry.talentCategory,
          country: galleryEntry.country,
          coordinates: safeParseJSON(galleryEntry.coordinates, null),
          questContext: safeParseJSON(galleryEntry.questContext, null),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Gallery entry creation error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create gallery entry" },
      { status: 500 },
    );
  }
}

function safeParseJSON<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
