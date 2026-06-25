import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { eq, desc, count, isNotNull, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { galleryEntries, moderationEvents } from "@/lib/schema";
import { ok, err } from "@/lib/server/result";
import { sanitizeInput } from "@/lib/sanitize";
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
// getGalleryEntryFn
// ---------------------------------------------------------------------------

export const getGalleryEntryFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetGalleryEntryInputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const entry = await db.query.galleryEntries.findFirst({
        where: eq(galleryEntries.id, data.id),
      });

      if (entry == null) {
        return err("not_found", "Gallery entry not found");
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
      const detectedTalents = safeParseJSON<Array<{ name: string; confidence: number }> | null>(
        entry.detectedTalents,
        null,
      );
      const talentTags = safeParseJSON<Array<{ name: string; confidence: number; category: string }> | null>(
        entry.talentTags,
        null,
      );

      return ok({
        id: entry.id,
        questId: entry.questId,
        imageUrl: entry.imageUrl,
        talentCategory: entry.talentCategory,
        talentConfidence: entry.talentConfidence,
        detectedTalents,
        talentTags,
        artworkStory: entry.artworkStory,
        country: entry.country,
        coordinates,
        questContext: stripLocalContext(questContext) as typeof questContext,
        journey: {
          missionCount: entry.missionCount,
          proofPhotoCount: entry.proofPhotoCount,
          questDurationDays: entry.questDurationDays,
        },
        createdAt: entry.createdAt.toISOString(),
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
