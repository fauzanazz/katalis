import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStorageClient } from "@/lib/storage";

const UploadCompleteSchema = z.object({
  key: z.string().min(1, "Storage key is required"),
  category: z.enum(["image", "audio"]),
});

/**
 * POST /api/upload/complete
 * 
 * Called after a successful upload to confirm the file and return
 * its public URL. Also performs server-side validation.
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession();
    if (!session?.childId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = UploadCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { key, category } = parsed.data;

    // Get the public URL for the uploaded file
    const storage = getStorageClient();
    const url = storage.getPublicUrl(key);

    return NextResponse.json(
      {
        success: true,
        key,
        url,
        category,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Upload complete error:", error);
    return NextResponse.json(
      { error: "internal", message: "Failed to complete upload" },
      { status: 500 },
    );
  }
}
