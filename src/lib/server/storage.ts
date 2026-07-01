import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import { getChildSession } from "@/lib/auth-start";
import { readGuestId, signGuestId, GUEST_ID_COOKIE } from "@/lib/guest-id";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { getStorageClient } from "@/lib/storage";
import { detectFileCategory } from "@/lib/storage/validation";
import { ok, err } from "@/lib/server/result";

const PresignedUrlSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required"),
});

const UploadCompleteSchema = z.object({
  key: z.string().min(1, "Storage key is required"),
  category: z.enum(["image", "audio"]),
});

export const getPresignedUploadUrlFn = createServerFn({ method: "POST" })
  .validator((d) => PresignedUrlSchema.parse(d))
  .handler(async ({ data }) => {
    const { filename, contentType } = data;

    const category = detectFileCategory(contentType);
    if (!category) {
      return err(
        "invalid_type",
        "Unsupported file type. Accepted: JPEG, PNG, WebP (images) or MP3, WAV, M4A, WebM, OGG (audio)",
      );
    }

    const session = await getChildSession();

    let pathPrefix: string;

    if (session) {
      pathPrefix = `child/${session.childId}`;
    } else {
      const request = getRequest();
      const ip = getClientIp(new Headers(request.headers)) ?? "unknown";
      const limit = await checkRateLimit(`presign:${ip}`, "guest-presign");
      if (limit.limited) {
        return err("rate_limited", "Too many upload requests");
      }

      let guestId = readGuestId(request);
      if (!guestId) {
        guestId = randomUUID();
        const signed = signGuestId(guestId);
        setCookie(GUEST_ID_COOKIE, signed, {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }

      pathPrefix = `guest/${guestId}`;
    }

    const storage = getStorageClient();
    const presigned = await storage.getPresignedUploadUrl({
      filename,
      contentType,
      category,
      pathPrefix,
    });

    return ok({ url: presigned.url, key: presigned.key, category });
  });

export const completeUploadFn = createServerFn({ method: "POST" })
  .validator((d) => UploadCompleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { key, category } = data;
    const session = await getChildSession();

    let expectedPrefix: string;
    if (session) {
      expectedPrefix = `child/${session.childId}/`;
    } else {
      const guestId = readGuestId(getRequest());
      if (!guestId) {
        return err("unauthorized", "Authentication required");
      }
      expectedPrefix = `guest/${guestId}/`;
    }

    if (!key.startsWith(expectedPrefix)) {
      return err("forbidden", "Key does not belong to caller");
    }

    const storage = getStorageClient();
    const url = storage.getPublicUrl(key);

    return ok({ key, url, category });
  });
