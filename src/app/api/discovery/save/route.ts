import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Schema for saving a discovery result */
const SaveDiscoverySchema = z.object({
  type: z.enum(["artifact", "story"], {
    message: "Type must be 'artifact' or 'story'",
  }),
  fileUrl: z.string().optional(),
  talents: z
    .array(
      z.object({
        name: z.string().min(1),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().min(1),
      }),
    )
    .min(1, "At least one talent must be provided"),
});

/**
 * POST /api/discovery/save
 *
 * Saves a discovery result (talents) to the database linked to the child's profile.
 *
 * Request body: { type: "artifact"|"story", fileUrl?: string, talents: Talent[] }
 * Response:     { id, type, talents, createdAt }
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getChildSession();
    if (!session) {
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

    // Validate input
    const parsed = SaveDiscoverySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json(
        { error: "invalid", message },
        { status: 400 },
      );
    }

    const { type, fileUrl, talents } = parsed.data;

    // Save discovery to database
    const discovery = await prisma.discovery.create({
      data: {
        childId: session.childId,
        type,
        fileUrl: fileUrl ?? null,
        aiAnalysis: JSON.stringify({ talents }),
        detectedTalents: JSON.stringify(talents),
      },
    });

    return NextResponse.json(
      {
        id: discovery.id,
        type: discovery.type,
        talents,
        createdAt: discovery.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Save discovery error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to save discovery results" },
      { status: 500 },
    );
  }
}
