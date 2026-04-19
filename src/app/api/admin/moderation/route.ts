import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    const pageSizeParam = parseInt(
      url.searchParams.get("pageSize") || "20",
      10,
    );
    const statusFilter = url.searchParams.get("status");
    const sourceTypeFilter = url.searchParams.get("sourceType");

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.min(
      100,
      Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam),
    );
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;
    if (sourceTypeFilter) where.sourceType = sourceTypeFilter;

    const [events, total] = await Promise.all([
      prisma.moderationEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.moderationEvent.count({ where }),
    ]);

    const [pendingCount, flaggedCount, blockedCount, approvedCount, totalEvents] =
      await Promise.all([
        prisma.moderationEvent.count({ where: { status: "pending" } }),
        prisma.moderationEvent.count({ where: { status: "flagged" } }),
        prisma.moderationEvent.count({ where: { status: "blocked" } }),
        prisma.moderationEvent.count({ where: { status: "approved" } }),
        prisma.moderationEvent.count(),
      ]);

    return NextResponse.json({
      events,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        pending: pendingCount,
        flagged: flaggedCount,
        blocked: blockedCount,
        approved: approvedCount,
        total: totalEvents,
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
