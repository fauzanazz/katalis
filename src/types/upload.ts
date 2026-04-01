/**
 * Shared upload types used by both client and server.
 * Provides a consistent result structure for image and audio uploads.
 */

import { z } from "zod";

/** Consistent upload result structure for both image and audio uploads */
export const UploadResultSchema = z.object({
  key: z.string(),
  url: z.string(),
  category: z.enum(["image", "audio"]),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
});

export type UploadResultData = z.infer<typeof UploadResultSchema>;

/** Upload state machine states */
export type UploadState =
  | "idle"
  | "validating"
  | "uploading"
  | "complete"
  | "error";

/** Audio recorder state */
export type RecorderState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "stopped"
  | "uploading"
  | "complete"
  | "error";
