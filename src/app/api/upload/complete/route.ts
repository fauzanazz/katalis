import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { getStorageClient } from "@/lib/storage";
import { readGuestId } from "@/lib/guest-id";

const UploadCompleteSchema = z.object({
  key: z.string().min(1, "Storage key is required"),
  category: z.enum(["image", "audio"]),
});

/**
 * POST /api/upload/complete
 *
 * Confirms a presigned upload by validating the storage key against the
 * caller's subject prefix:
 *
 *   - Authed children may only complete keys under `child/{childId}/`.
 *   - Guests (with a valid signed `katalis_guest_id` cookie) may only
 *     complete keys under `guest/{guestId}/`.
 *
 * Cross-prefix claims are rejected to prevent linking a stranger's upload
 * to the caller's session.
 */
export async function POST(request: NextRequest) {
  try {
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
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { key, category } = parsed.data;
    const session = await getChildSession();

    let expectedPrefix: string;
    if (session) {
      expectedPrefix = `child/${session.childId}/`;
    } else {
      const guestId = readGuestId(request);
      if (!guestId) {
        return NextResponse.json(
          { error: "unauthorized", message: "Authentication required" },
          { status: 401 },
        );
      }
      expectedPrefix = `guest/${guestId}/`;
    }

    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "forbidden", message: "Key does not belong to caller" },
        { status: 403 },
      );
    }

    const storage = getStorageClient();
    const url = storage.getPublicUrl(key);

    return NextResponse.json(
      { success: true, key, url, category },
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
