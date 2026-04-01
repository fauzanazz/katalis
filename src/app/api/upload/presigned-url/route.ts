import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStorageClient } from "@/lib/storage";
import { detectFileCategory } from "@/lib/storage/validation";

const PresignedUrlSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required"),
});

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

    // Parse and validate request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = PresignedUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { filename, contentType } = parsed.data;

    // Detect category from content type
    const category = detectFileCategory(contentType);
    if (!category) {
      return NextResponse.json(
        {
          error: "invalid_type",
          message: "Unsupported file type. Accepted: JPEG, PNG, WebP (images) or MP3, WAV, M4A (audio)",
        },
        { status: 400 },
      );
    }

    // Generate presigned URL via storage client
    const storage = getStorageClient();
    const presigned = await storage.getPresignedUploadUrl({
      filename,
      contentType,
      category,
    });

    return NextResponse.json(
      {
        url: presigned.url,
        key: presigned.key,
        category,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "internal", message: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
