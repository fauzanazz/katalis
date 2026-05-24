import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderationEvents } from "@/lib/schema";
import { eq, desc, count, and, SQL } from "drizzle-orm";

/**
 * GET /api/admin/moderation
 *
 * List moderation events with pagination and filtering.
 * Admin-only endpoint.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "unauthorized", message: "Admin access required" },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const statusFilter = url.searchParams.get("status");
    const sourceTypeFilter = url.searchParams.get("sourceType");

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.min(100, Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam));
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];
    if (statusFilter) conditions.push(eq(moderationEvents.status, statusFilter));
    if (sourceTypeFilter) conditions.push(eq(moderationEvents.sourceType, sourceTypeFilter));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [events, totalRows] = await Promise.all([
      db.query.moderationEvents.findMany({
        where,
        offset,
        limit: pageSize,
        orderBy: desc(moderationEvents.createdAt),
      }),
      db.select({ count: count() }).from(moderationEvents).where(where),
    ]);

    const total = totalRows[0].count;

    const [pendingCount, flaggedCount, blockedCount, approvedCount, totalEvents] =
      await Promise.all([
        db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "pending")),
        db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "flagged")),
        db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "blocked")),
        db.select({ count: count() }).from(moderationEvents).where(eq(moderationEvents.status, "approved")),
        db.select({ count: count() }).from(moderationEvents),
      ]);

    return NextResponse.json({
      events,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        pending: pendingCount[0].count,
        flagged: flaggedCount[0].count,
        blocked: blockedCount[0].count,
        approved: approvedCount[0].count,
        total: totalEvents[0].count,
      },
    });
  } catch (error) {
    console.error("Moderation list error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch moderation events" },
      { status: 500 },
    );
  }
}
