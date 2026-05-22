import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { getParentChildren } from "@/lib/parent/link";
import { getTipsForChild } from "@/lib/parent/home-tips";
import { listSnapshots } from "@/lib/zpd";

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const children = await getParentChildren(session.userId);

    const enriched = await Promise.all(
      children.map(async (child) => {
        const snapshots = await listSnapshots(child.id, 30).catch((error) => {
          console.error(
            `ZPD snapshot fetch failed for child ${child.id}:`,
            error,
          );
          return [];
        });
        return {
          ...child,
          tips: getTipsForChild({ talents: child.latestTalents ?? [] }),
          zpdSnapshots: snapshots.map((s) => ({
            id: s.id,
            score: s.score,
            band: s.band,
            createdAt: s.createdAt.toISOString(),
          })),
        };
      }),
    );

    return NextResponse.json({ children: enriched });
  } catch (error) {
    console.error("Parent children fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch children" },
      { status: 500 },
    );
  }
}
