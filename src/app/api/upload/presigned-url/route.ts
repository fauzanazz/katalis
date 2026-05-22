import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { getStorageClient } from "@/lib/storage";
import { detectFileCategory } from "@/lib/storage/validation";
import { resolveGuestId } from "@/lib/guest-id";
import { checkRateLimit } from "@/lib/rate-limit";

const PresignedUrlSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required"),
});

function getClientIp(request: NextRequest | Request): string {
  return (
    (request.headers.get("x-forwarded-for") ?? "")
      .split(",")[0]
      ?.trim() || "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
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
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { filename, contentType } = parsed.data;

    const category = detectFileCategory(contentType);
    if (!category) {
      return NextResponse.json(
        {
          error: "invalid_type",
          message:
            "Unsupported file type. Accepted: JPEG, PNG, WebP (images) or MP3, WAV, M4A (audio)",
        },
        { status: 400 },
      );
    }

    const session = await getChildSession();

    let pathPrefix: string;
    let setCookie: string | null = null;

    if (session) {
      pathPrefix = `child/${session.childId}`;
    } else {
      const ip = getClientIp(request);
      const limit = await checkRateLimit(`presign:${ip}`, "guest-presign");
      if (limit.limited) {
        return NextResponse.json(
          { error: "rate_limited", message: "Too many upload requests" },
          {
            status: 429,
            headers: {
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": limit.resetAt.toISOString(),
            },
          },
        );
      }

      const guest = resolveGuestId(request);
      pathPrefix = `guest/${guest.id}`;
      setCookie = guest.setCookie;
    }

    const storage = getStorageClient();
    const presigned = await storage.getPresignedUploadUrl({
      filename,
      contentType,
      category,
      pathPrefix,
    });

    const response = NextResponse.json(
      { url: presigned.url, key: presigned.key, category },
      { status: 200 },
    );
    if (setCookie) response.headers.set("set-cookie", setCookie);
    return response;
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "internal", message: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
