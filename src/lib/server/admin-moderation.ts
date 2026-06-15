import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-start";
import { db } from "@/lib/db";
import { moderationEvents } from "@/lib/schema";
import { eq, desc, count } from "drizzle-orm";
import { ok, err, type Result } from "@/lib/server/result";

export type ModerationEventRow = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  contentType: string;
  contentHash: string | null;
  status: string;
  category: string | null;
  severity: string | null;
  confidence: number | null;
  aiReasoning: string | null;
  childId: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
};

function toRow(event: {
  id: string;
  sourceType: string;
  sourceId: string | null;
  contentType: string;
  contentHash: string | null;
  status: string;
  category: string | null;
  severity: string | null;
  confidence: number | null;
  aiReasoning: string | null;
  childId: string | null;
  reviewerId: string | null;
  reviewedAt: Date | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ModerationEventRow {
  return {
    id: event.id,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    contentType: event.contentType,
    contentHash: event.contentHash,
    status: event.status,
    category: event.category,
    severity: event.severity,
    confidence: event.confidence,
    aiReasoning: event.aiReasoning,
    childId: event.childId,
    reviewerId: event.reviewerId,
    reviewedAt: event.reviewedAt ? event.reviewedAt.toISOString() : null,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function safeParseJSON(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Whitelist real moderation statuses so junk filter values are rejected, not
// silently passed to the DB. UI only emits flagged/pending/blocked/approved;
// "redirected" included for hand-typed URLs that were valid before.
const ListValidator = z.object({
  status: z
    .enum(["pending", "flagged", "blocked", "approved", "redirected"])
    .optional(),
});

export const listModerationEventsFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => ListValidator.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ events: ModerationEventRow[]; pending: number; flagged: number; blocked: number; approved: number; total: number }>> => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      const { status: statusFilter } = data;
      const where = statusFilter
        ? eq(moderationEvents.status, statusFilter)
        : undefined;

      const [rawEvents, pendingCount, flaggedCount, blockedCount, approvedCount, totalCount] =
        await Promise.all([
          db.query.moderationEvents.findMany({
            where,
            limit: 50,
            orderBy: desc(moderationEvents.createdAt),
          }),
          db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "pending")).then((r) => r[0]!.count),
          db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "flagged")).then((r) => r[0]!.count),
          db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "blocked")).then((r) => r[0]!.count),
          db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "approved")).then((r) => r[0]!.count),
          db.select({ count: count() }).from(moderationEvents).then((r) => r[0]!.count),
        ]);

      return ok({
        events: rawEvents.map(toRow),
        pending: pendingCount,
        flagged: flaggedCount,
        blocked: blockedCount,
        approved: approvedCount,
        total: totalCount,
      });
    },
  );

const ReviewValidator = z.object({
  eventId: z.string(),
  action: z.enum(["approve", "block"]),
  notes: z.string().max(1000).optional(),
});

export const reviewModerationEventFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => ReviewValidator.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ event: ModerationEventRow }>> => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      const { eventId, action, notes } = data;

      const existing = await db.query.moderationEvents.findFirst({
        where: eq(moderationEvents.id, eventId),
      });
      if (!existing) return err("not_found", "Moderation event not found");

      const newStatus = action === "approve" ? "approved" : "blocked";

      const updated = (
        await db
          .update(moderationEvents)
          .set({
            status: newStatus,
            reviewerId: admin.userId,
            reviewedAt: new Date(),
            metadata: notes
              ? JSON.stringify({
                  ...safeParseJSON(existing.metadata),
                  reviewNotes: notes,
                })
              : existing.metadata,
          })
          .where(eq(moderationEvents.id, eventId))
          .returning()
      )[0];

      return ok({ event: toRow(updated) });
    },
  );
