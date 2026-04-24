import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { getAllTips } from "@/lib/parent/home-tips";

/**
 * GET /api/parent/tips
 *
 * Get all parenting tips, optionally filtered by category.
 * Query params: category (optional)
 */
export async function GET(request: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const categoryFilter = url.searchParams.get("category");

    const tips =
      categoryFilter && categoryFilter !== "all"
        ? getAllTips(categoryFilter)
        : getAllTips();

    const categories = [
      { slug: "all", label: "All Tips", icon: "💡" },
      { slug: "Engineering", label: "Engineering", icon: "🔧" },
      { slug: "Art", label: "Art & Design", icon: "🎨" },
      { slug: "Narrative", label: "Storytelling", icon: "📖" },
      { slug: "Music", label: "Music", icon: "🎵" },
      { slug: "Science", label: "Science", icon: "🔬" },
      { slug: "Creative", label: "Creative", icon: "✨" },
    ];

    return NextResponse.json({ tips, categories });
  } catch (error) {
    console.error("Tips fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch tips" },
      { status: 500 },
    );
  }
}
