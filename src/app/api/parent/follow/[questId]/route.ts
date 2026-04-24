import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyParentChildLink } from "@/lib/parent/link";

/**
 * POST /api/parent/follow/[questId] — Start following a quest
 * DELETE /api/parent/follow/[questId] — Stop following a quest
 * PATCH /api/parent/follow/[questId] — Update follow (mark day viewed)
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { questId } = await params;

    const quest = await prisma.quest.findUnique({
      where: { id: questId },
      select: { id: true, childId: true },
    });

    if (!quest) {
      return NextResponse.json(
        { error: "not_found", message: "Quest not found" },
        { status: 404 },
      );
    }

    const isLinked = await verifyParentChildLink(session.userId, quest.childId);
    if (!isLinked) {
      return NextResponse.json(
        { error: "forbidden", message: "Not linked to this child" },
        { status: 403 },
      );
    }

    const follow = await prisma.parentQuestFollow.upsert({
      where: {
        parentId_questId: { parentId: session.userId, questId },
      },
      update: { lastViewedAt: new Date() },
      create: {
        parentId: session.userId,
        childId: quest.childId,
        questId,
      },
    });

    return NextResponse.json({ success: true, follow });
  } catch (error) {
    console.error("Parent follow error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to follow quest" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { questId } = await params;

    await prisma.parentQuestFollow.deleteMany({
      where: { parentId: session.userId, questId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Parent unfollow error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to unfollow quest" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { questId } = await params;
    const body = await request.json().catch(() => ({}));

    const follow = await prisma.parentQuestFollow.update({
      where: {
        parentId_questId: { parentId: session.userId, questId },
      },
      data: {
        currentDay: body.currentDay ?? undefined,
        lastViewedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, follow });
  } catch (error) {
    console.error("Parent follow update error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update follow" },
      { status: 500 },
    );
  }
}
