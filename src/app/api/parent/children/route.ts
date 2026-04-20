import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { getParentChildren } from "@/lib/parent/link";
import { getTipsForChild } from "@/lib/parent/home-tips";

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

    const enriched = children.map((child) => ({
      ...child,
      tips: getTipsForChild({
        talents: child.latestTalents ?? [],
      }),
    }));

    return NextResponse.json({ children: enriched });
  } catch (error) {
    console.error("Parent children fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch children" },
      { status: 500 },
    );
  }
}
