import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { eq, desc, asc, count, isNotNull, and, isNull } from "drizzle-orm";

import { getChildSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import { galleryEntries, galleryLikes, galleryComments, quests, missions, moderationEvents, children } from "@/lib/schema";
import { ok, err } from "@/lib/server/result";
import { sanitizeInput } from "@/lib/sanitize";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { geocodeLocationText, snapToNearestPlace } from "@/lib/geocoding";
import { autoJoinSquad } from "@/lib/squads/auto-join";
import { moderateImageContent } from "@/lib/moderation";
import { classifyTags } from "@/lib/ai/tag-classifier";
import { stripLocalContext } from "@/lib/privacy/quest-context";
import { clusterGalleryEntries } from "@/lib/ai/client";
import type { ClusterEntry } from "@/lib/ai/clustering-schemas";
import type { ClusteringOutput } from "@/lib/ai/clustering-schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { getAllSquads, getSquadById } from "@/lib/squads";
import type { SquadSummary, SquadDetail } from "@/lib/squads";

// Concrete type for quest context stored in gallery entries
type QuestContextShape = {
  questTitle?: string;
  dream?: string;
  missionSummaries?: string[];
} | null;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ListGalleryEntriesInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  talentCategory: z.string().optional(),
  tag: z.string().optional(),
});

export const CreateGalleryEntryInputSchema = z.object({
  questId: z.string().min(1, "Quest ID is required"),
  selectedPhotoUrl: z.string().url().optional(),
});

export const GetGalleryEntryInputSchema = z.object({
  id: z.string().min(1),
});

export const GetGalleryGeoJsonInputSchema = z.object({
  talentCategory: z.string().optional(),
});

export const FlagGalleryEntryInputSchema = z.object({
  entryId: z.string().min(1, "Entry ID is required"),
  reason: z.enum(["inappropriate", "offensive", "spam", "other"], {
    message: "Invalid flag reason",
  }),
  details: z.string().max(500).optional(),
});

export const LikeGalleryEntryInputSchema = z.object({
  entryId: z.string().min(1),
});

export const AddGalleryCommentInputSchema = z.object({
  entryId: z.string().min(1),
  content: z.string().min(1).max(200),
});

export const GetSquadInputSchema = z.object({
  squadId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const REASON_TO_CATEGORY: Record<string, string> = {
  inappropriate: "sexual",
  offensive: "hate",
  spam: "spam",
  other: "other",
};

// ---------------------------------------------------------------------------
// listGalleryEntriesFn
// ---------------------------------------------------------------------------

export const listGalleryEntriesFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => ListGalleryEntriesInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { page, pageSize, talentCategory, tag } = data;
      const offset = (page - 1) * pageSize;

      const whereCondition = talentCategory
        ? eq(galleryEntries.talentCategory, talentCategory)
        : undefined;

      if (tag) {
        const allTagEntries = await db.query.galleryEntries.findMany({
          where: whereCondition,
          orderBy: desc(galleryEntries.createdAt),
        });

        const matched = allTagEntries
          .map((entry) => ({
            id: entry.id,
            questId: entry.questId,
            imageUrl: entry.imageUrl,
            talentCategory: entry.talentCategory,
            country: entry.country,
            questContext: stripLocalContext(safeParseJSON(entry.questContext, null)) as QuestContextShape,
            talentTags: safeParseJSON<Array<{ name: string }> | null>(entry.talentTags, null),
            clusterGroup: entry.clusterGroup,
            createdAt: entry.createdAt,
          }))
          .filter((entry) => {
            if (!entry.talentTags) return false;
            return entry.talentTags.some((t) =>
              t.name.toLowerCase().includes(tag.toLowerCase()),
            );
          });

        const paged = matched.slice(offset, offset + pageSize);

        return ok({
          entries: paged,
          total: matched.length,
          page,
          pageSize,
          totalPages: Math.ceil(matched.length / pageSize),
        });
      }

      const [entries, [{ count: total }]] = await Promise.all([
        db.query.galleryEntries.findMany({
          where: whereCondition,
          offset,
          limit: pageSize,
          orderBy: desc(galleryEntries.createdAt),
        }),
        db
          .select({ count: count() })
          .from(galleryEntries)
          .where(whereCondition),
      ]);

      const sanitizedEntries = entries.map((entry) => ({
        id: entry.id,
        questId: entry.questId,
        imageUrl: entry.imageUrl,
        talentCategory: entry.talentCategory,
        country: entry.country,
        questContext: stripLocalContext(safeParseJSON(entry.questContext, null)) as QuestContextShape,
        talentTags: safeParseJSON<Array<{ name: string }> | null>(entry.talentTags, null),
        clusterGroup: entry.clusterGroup,
        createdAt: entry.createdAt,
      }));

      return ok({
        entries: sanitizedEntries,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      console.error("Gallery entries fetch error:", error);
      return err("server_error", "Failed to fetch gallery entries");
    }
  });

// ---------------------------------------------------------------------------
// createGalleryEntryFn
// ---------------------------------------------------------------------------

export const createGalleryEntryFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateGalleryEntryInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) {
        return err("unauthorized", "Authentication required");
      }

      const { questId, selectedPhotoUrl: rawPhotoUrl } = data;

      const quest = await db.query.quests.findFirst({
        where: eq(quests.id, questId),
        with: {
          missions: { orderBy: asc(missions.day) },
          discovery: true,
        },
      });

      if (!quest) {
        return err("not_found", "Quest not found");
      }

      if (quest.childId !== session.childId) {
        return err("forbidden", "Access denied");
      }

      const allCompleted = quest.missions.every((m) => m.status === "completed");
      if (!allCompleted) {
        return err(
          "incomplete_quest",
          "All 7 missions must be completed before creating a gallery entry.",
        );
      }

      let photoUrl = rawPhotoUrl;
      if (photoUrl) {
        photoUrl = sanitizeInput(photoUrl);
        if (!isAllowedStorageUrl(photoUrl)) {
          return err("invalid", "Invalid photo URL origin");
        }
      } else {
        const firstProof = quest.missions.find((m) => m.proofPhotoUrl);
        photoUrl = firstProof?.proofPhotoUrl ?? undefined;
      }

      if (!photoUrl) {
        return err("invalid", "No photo available for gallery entry");
      }

      if (rawPhotoUrl) {
        const validPhotoUrls = quest.missions
          .filter((m) => m.proofPhotoUrl)
          .map((m) => m.proofPhotoUrl);
        if (!validPhotoUrls.includes(photoUrl)) {
          return err(
            "invalid_photo",
            "Selected photo must be from one of the quest's completed missions.",
          );
        }
      }

      const existingEntry = await db.query.galleryEntries.findFirst({
        where: and(eq(galleryEntries.questId, questId), isNull(galleryEntries.missionId)),
      });
      if (existingEntry) {
        return err("duplicate_entry", "A gallery entry already exists for this quest.");
      }

      const imageModeration = await moderateImageContent({
        imageUrl: photoUrl,
        sourceType: "gallery",
        sourceId: questId,
        childId: session.childId,
      });

      if (!imageModeration.allowed) {
        // PRESERVE: content_blocked stays as ok (HTTP-200 quirk, NOT err)
        return ok({
          error: "content_blocked" as const,
          message:
            imageModeration.redirectMessage ??
            "This image cannot be displayed publicly. Try a different photo!",
          redirect: true as const,
        });
      }

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

      const geoResult = geocodeLocationText(quest.localContext);
      const country = geoResult?.country ?? null;
      const coordinates = geoResult?.coordinates
        ? JSON.stringify(snapToNearestPlace(geoResult.coordinates.lat, geoResult.coordinates.lng).coordinates)
        : null;

      const questContext = JSON.stringify({
        questTitle: quest.dream,
        dream: quest.dream,
        missionSummaries: quest.missions.map((m) => m.title),
      });

      const galleryEntry = await db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(galleryEntries)
          .values({
            childId: session.childId,
            questId,
            imageUrl: photoUrl!,
            talentCategory,
            country,
            coordinates,
            questContext,
          })
          .returning();

        await tx
          .update(quests)
          .set({ status: "completed" })
          .where(eq(quests.id, questId));

        return entry;
      });

      await autoJoinSquad(session.childId, talentCategory, galleryEntry.id, country).catch(() => {});

      let classifiedTags: Array<{ name: string; confidence: number; category: string }> | null = null;
      try {
        const tagResult = await classifyTags(
          talentCategory,
          quest.discovery?.detectedTalents ?? undefined,
        );
        if (tagResult.tags.length > 0) {
          classifiedTags = tagResult.tags;
          await db
            .update(galleryEntries)
            .set({ talentTags: JSON.stringify(tagResult.tags) })
            .where(eq(galleryEntries.id, galleryEntry.id));
        }
      } catch (tagError) {
        console.warn("Tag classification failed (non-blocking):", tagError);
      }

      return ok({
        success: true as const,
        galleryEntry: {
          id: galleryEntry.id,
          questId: galleryEntry.questId,
          imageUrl: galleryEntry.imageUrl,
          talentCategory: galleryEntry.talentCategory,
          country: galleryEntry.country,
          questContext: stripLocalContext(safeParseJSON(galleryEntry.questContext, null)) as QuestContextShape,
          talentTags: classifiedTags,
        },
      });
    } catch (error) {
      console.error("Gallery entry creation error:", error);
      return err("server_error", "Failed to create gallery entry");
    }
  });

// ---------------------------------------------------------------------------
// getGalleryEntryFn
// ---------------------------------------------------------------------------

export const getGalleryEntryFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetGalleryEntryInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession().catch(() => null);

      const entry = await db.query.galleryEntries.findFirst({
        where: eq(galleryEntries.id, data.id),
      });

      if (entry == null) {
        return err("not_found", "Gallery entry not found");
      }

      const [likes, rawComments] = await Promise.all([
        db.query.galleryLikes.findMany({
          where: eq(galleryLikes.entryId, data.id),
        }),
        db.query.galleryComments.findMany({
          where: eq(galleryComments.entryId, data.id),
          orderBy: asc(galleryComments.createdAt),
        }),
      ]);

      const childIds = [...new Set(rawComments.map((c) => c.childId))];
      const childNames: Record<string, string> = {};
      if (childIds.length > 0) {
        const childRows = await db.query.children.findMany({
          where: (c, { inArray }) => inArray(c.id, childIds),
          columns: { id: true, name: true },
        });
        for (const c of childRows) childNames[c.id] = c.name ?? "Explorer";
      }

      const coordinates = safeParseJSON<{ lat: number; lng: number } | null>(
        entry.coordinates,
        null,
      );
      const questContext = safeParseJSON<{
        questTitle?: string;
        dream?: string;
        missionSummaries?: string[];
      } | null>(entry.questContext, null);

      const likesCount = likes.length;
      const userHasLiked = session
        ? likes.some((l) => l.childId === session.childId)
        : false;
      const commentList = rawComments.map((c) => ({
        id: c.id,
        content: c.content,
        authorName: childNames[c.childId] ?? "Explorer",
        createdAt: c.createdAt.toISOString(),
        isOwn: session ? c.childId === session.childId : false,
      }));

      return ok({
        id: entry.id,
        imageUrl: entry.imageUrl,
        caption: entry.caption,
        talentCategory: entry.talentCategory,
        country: entry.country,
        coordinates,
        questContext,
        createdAt: entry.createdAt.toISOString(),
        likesCount,
        userHasLiked,
        comments: commentList,
      });
    } catch (error) {
      console.error("Gallery entry fetch error:", error);
      return err("server_error", "Failed to fetch gallery entry");
    }
  });

// ---------------------------------------------------------------------------
// getGalleryGeoJsonFn
// ---------------------------------------------------------------------------

type GeoJsonFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    imageUrl: string;
    talentCategory: string;
    country: string;
    questContext: {
      questTitle?: string;
      dream?: string;
      missionSummaries?: string[];
      localContext?: string;
    } | null;
    createdAt: string;
  };
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export const getGalleryGeoJsonFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetGalleryGeoJsonInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { talentCategory } = data;

      const whereCondition = talentCategory
        ? and(isNotNull(galleryEntries.coordinates), eq(galleryEntries.talentCategory, talentCategory))
        : isNotNull(galleryEntries.coordinates);

      const entries = await db.query.galleryEntries.findMany({
        where: whereCondition,
        orderBy: desc(galleryEntries.createdAt),
      });

      const features: GeoJsonFeature[] = entries
        .map((entry) => {
          const coords = safeParseJSON<{ lat: number; lng: number } | null>(
            entry.coordinates,
            null,
          );
          if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
            return null;
          }

          const questContext = safeParseJSON<{
            questTitle?: string;
            dream?: string;
            missionSummaries?: string[];
            localContext?: string;
          } | null>(entry.questContext, null);

          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [coords.lng, coords.lat] as [number, number],
            },
            properties: {
              id: entry.id,
              imageUrl: entry.imageUrl,
              talentCategory: entry.talentCategory,
              country: entry.country ?? "",
              questContext: stripLocalContext(questContext),
              createdAt: entry.createdAt.toISOString(),
            },
          };
        })
        .filter((f): f is GeoJsonFeature => f !== null);

      const result: GeoJsonFeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      return ok(result);
    } catch (error) {
      console.error("Gallery GeoJSON fetch error:", error);
      return err("server_error", "Failed to fetch gallery entries");
    }
  });

// ---------------------------------------------------------------------------
// clusterGalleryEntriesFn
// ---------------------------------------------------------------------------

type EnrichedCluster = {
  id: string;
  label: string;
  description: string;
  talentTheme: string;
  countries: string[];
  entryIds: string[];
  entries: Array<{
    id: string;
    imageUrl: string;
    talentCategory: string;
    country: string | null;
    questContext: QuestContextShape;
    createdAt: Date;
  }>;
};

export const clusterGalleryEntriesFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const entries = await db.query.galleryEntries.findMany({
      where: isNotNull(galleryEntries.coordinates),
      orderBy: desc(galleryEntries.createdAt),
    });

    if (entries.length === 0) {
      return ok({ clusters: [] as EnrichedCluster[], totalEntries: 0 });
    }

    const clusterEntries: ClusterEntry[] = entries.map((entry) => {
      let coords: { lat: number; lng: number } | null = null;
      if (entry.coordinates) {
        try {
          coords = JSON.parse(entry.coordinates) as { lat: number; lng: number };
        } catch {
          coords = null;
        }
      }

      return {
        id: entry.id,
        talentCategory: entry.talentCategory,
        country: entry.country,
        coordinates: coords,
      };
    });

    const result: ClusteringOutput = await clusterGalleryEntries(clusterEntries);

    const entryMap = new Map(entries.map((e) => [e.id, e]));
    const enrichedClusters: EnrichedCluster[] = result.clusters.map((cluster) => ({
      ...cluster,
      entries: cluster.entryIds
        .map((id) => {
          const entry = entryMap.get(id);
          if (!entry) return null;

          let questContext: QuestContextShape = null;
          if (entry.questContext) {
            try {
              questContext = stripLocalContext(JSON.parse(entry.questContext)) as QuestContextShape;
            } catch {
              questContext = null;
            }
          }

          return {
            id: entry.id,
            imageUrl: entry.imageUrl,
            talentCategory: entry.talentCategory,
            country: entry.country,
            questContext,
            createdAt: entry.createdAt,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    }));

    return ok({ clusters: enrichedClusters, totalEntries: entries.length });
  } catch (error) {
    console.error("Gallery clustering error:", error);
    return err("server_error", "Failed to generate gallery clusters");
  }
});

// ---------------------------------------------------------------------------
// flagGalleryEntryFn
// ---------------------------------------------------------------------------

export const flagGalleryEntryFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => FlagGalleryEntryInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { entryId, reason, details } = data;

      const ip = getClientIp(new Headers(getRequestHeaders())) ?? "unknown";
      const { limited } = await checkRateLimit(`flag:${ip}`, "flag");
      if (limited) {
        return err("rate_limited", "Too many reports. Please try again later.");
      }

      const sanitizedDetails = details ? sanitizeInput(details) : undefined;

      await db.insert(moderationEvents).values({
        sourceType: "flag",
        sourceId: entryId,
        contentType: "image",
        status: "flagged",
        category: REASON_TO_CATEGORY[reason] ?? "other",
        severity: reason === "inappropriate" ? "high" : "medium",
        metadata: JSON.stringify({
          reason,
          details: sanitizedDetails,
        }),
      });

      return ok({
        success: true as const,
        message: "Thank you for reporting. Our team will review this content.",
      });
    } catch (error) {
      console.error("Content flag error:", error);
      return err("server_error", "Failed to submit report");
    }
  });

// ---------------------------------------------------------------------------
// listSquadsFn
// ---------------------------------------------------------------------------

export const listSquadsFn = createServerFn({ method: "GET" }).handler(async () => {
  const squads: SquadSummary[] = await getAllSquads();
  return ok({ squads });
});

// ---------------------------------------------------------------------------
// getSquadFn
// ---------------------------------------------------------------------------

type SerializableSquadDetail = Omit<SquadDetail, "entries"> & {
  entries: Array<{
    id: string;
    imageUrl: string;
    talentCategory: string;
    country: string | null;
    questContext: QuestContextShape;
    createdAt: string;
  }>;
};

export const getSquadFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetSquadInputSchema.parse(d))
  .handler(async ({ data }) => {
    const raw: SquadDetail | null = await getSquadById(data.squadId);
    if (raw == null) {
      return err("not_found", "Squad not found");
    }
    const squad: SerializableSquadDetail = {
      ...raw,
      entries: raw.entries.map((e) => ({
        ...e,
        questContext: e.questContext as QuestContextShape,
      })),
    };
    return ok({ squad });
  });

// ---------------------------------------------------------------------------
// likeGalleryEntryFn — toggle like
// ---------------------------------------------------------------------------

export const likeGalleryEntryFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => LikeGalleryEntryInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) return err("unauthorized", "Authentication required");

      const { entryId } = data;

      const existing = await db.query.galleryLikes.findFirst({
        where: and(
          eq(galleryLikes.entryId, entryId),
          eq(galleryLikes.childId, session.childId),
        ),
      });

      if (existing) {
        await db.delete(galleryLikes).where(eq(galleryLikes.id, existing.id));
      } else {
        await db.insert(galleryLikes).values({ entryId, childId: session.childId });
      }

      const [{ value: likesCount }] = await db
        .select({ value: count() })
        .from(galleryLikes)
        .where(eq(galleryLikes.entryId, entryId));

      return ok({ liked: !existing, likesCount });
    } catch (error) {
      console.error("Gallery like error:", error);
      return err("server_error", "Failed to toggle like");
    }
  });

// ---------------------------------------------------------------------------
// addGalleryCommentFn
// ---------------------------------------------------------------------------

export const addGalleryCommentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => AddGalleryCommentInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const session = await getChildSession();
      if (!session) return err("unauthorized", "Authentication required");

      const { entryId, content } = data;
      const sanitized = sanitizeInput(content);
      if (!sanitized) return err("invalid", "Comment cannot be empty");

      const entry = await db.query.galleryEntries.findFirst({
        where: eq(galleryEntries.id, entryId),
        columns: { id: true },
      });
      if (!entry) return err("not_found", "Gallery entry not found");

      const child = await db.query.children.findFirst({
        where: eq(children.id, session.childId),
        columns: { name: true },
      });

      const [comment] = await db
        .insert(galleryComments)
        .values({ entryId, childId: session.childId, content: sanitized })
        .returning();

      return ok({
        id: comment.id,
        content: comment.content,
        authorName: child?.name ?? "Explorer",
        createdAt: comment.createdAt.toISOString(),
        isOwn: true,
      });
    } catch (error) {
      console.error("Gallery comment error:", error);
      return err("server_error", "Failed to add comment");
    }
  });
