import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { isStrippableImage, stripExifMetadata } from "../src/lib/storage/exif";
import {
  detectFileCategory,
  validateFile,
} from "../src/lib/storage/validation";

/**
 * Dev-only mock storage upload endpoint.
 *
 * In production the upload presigned URL points straight at Cloudflare R2, so
 * nothing needs to receive the PUT here. In local dev (USE_MOCK_STORAGE, or
 * USE_MOCK_AI as the legacy fallback) the presigned URL instead points at
 * `${baseUrl}/api/storage/upload/<key>` — this middleware is that target.
 *
 * Ported verbatim from the deleted Next route
 * src/app/api/storage/upload/[...key]/route.ts. TanStack Start owns dev routing
 * and has no raw-PUT route API, so the handler lives as a Connect middleware on
 * the Vite dev server (`apply: "serve"` → never runs in the built `.output`).
 * File validation + EXIF stripping reuse the framework-agnostic storage libs
 * (`@/lib/storage/{validation,exif}`), imported directly since they only pull in
 * `sharp` and plain constants.
 */
const UPLOAD_PREFIX = "/api/storage/upload/";

export function devMockStoragePlugin(): Plugin {
  return {
    name: "katalis:dev-mock-storage",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "PUT" || !req.url?.startsWith(UPLOAD_PREFIX)) {
          return next();
        }

        const sendJson = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        };

        const useMock =
          process.env.USE_MOCK_STORAGE !== undefined
            ? process.env.USE_MOCK_STORAGE === "true"
            : process.env.USE_MOCK_AI === "true";
        if (!useMock) return sendJson(404, { error: "not_found" });

        try {
          const rawPath = req.url.slice(UPLOAD_PREFIX.length).split("?")[0];
          const keySegments = rawPath
            .split("/")
            .map((segment) => decodeURIComponent(segment));
          if (
            keySegments.length === 0 ||
            keySegments.some(
              (segment) =>
                !segment ||
                segment === "." ||
                segment === ".." ||
                segment.includes("..") ||
                /[^A-Za-z0-9._-]/.test(segment),
            )
          ) {
            return sendJson(400, {
              error: "invalid",
              message: "Invalid upload key",
            });
          }

          const contentTypeHeader = req.headers["content-type"];
          const contentType =
            (Array.isArray(contentTypeHeader)
              ? contentTypeHeader[0]
              : contentTypeHeader) || "application/octet-stream";

          const category = detectFileCategory(contentType);
          if (!category) {
            return sendJson(400, {
              error: "invalid_type",
              message: "Unsupported file type",
            });
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          let data: Buffer = Buffer.concat(chunks);

          const validation = validateFile(contentType, data.length, category);
          if (!validation.valid) {
            return sendJson(400, {
              error: "validation",
              message: validation.error,
            });
          }

          if (isStrippableImage(contentType)) {
            data = await stripExifMetadata(data, contentType);
          }

          const uploadsRoot = path.join(process.cwd(), "public", "uploads");
          const filePath = path.resolve(uploadsRoot, ...keySegments);
          if (!filePath.startsWith(path.resolve(uploadsRoot) + path.sep)) {
            return sendJson(400, {
              error: "invalid",
              message: "Invalid upload key",
            });
          }
          await mkdir(path.dirname(filePath), { recursive: true });
          await writeFile(filePath, data);

          res.statusCode = 200;
          res.end();
        } catch (error) {
          console.error("[dev-mock-storage] upload error:", error);
          sendJson(500, { error: "internal", message: "Upload failed" });
        }
      });
    },
  };
}
