import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripExifMetadata, isStrippableImage } from "@/lib/storage/exif";
import { validateFile, detectFileCategory } from "@/lib/storage/validation";

/**
 * PUT /api/storage/upload/[...key]
 * 
 * Mock presigned-URL endpoint. In development, the presigned URL points here
 * instead of to R2. Accepts a raw file body and saves to public/uploads/.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key: keySegments } = await params;
    const key = keySegments.join("/");

    const contentType = request.headers.get("content-type") || "application/octet-stream";
    
    // Detect file category from content type
    const category = detectFileCategory(contentType);
    if (!category) {
      return NextResponse.json(
        { error: "invalid_type", message: "Unsupported file type" },
        { status: 400 },
      );
    }

    // Read body as ArrayBuffer
    const arrayBuffer = await request.arrayBuffer();
    let data: Buffer = Buffer.from(new Uint8Array(arrayBuffer)) as Buffer;

    // Validate file
    const validation = validateFile(contentType, data.length, category);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "validation", message: validation.error },
        { status: 400 },
      );
    }

    // Strip EXIF metadata from images
    if (isStrippableImage(contentType)) {
      data = await stripExifMetadata(data, contentType);
    }

    // Save file to public/uploads/
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadsRoot, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json(
      { error: "internal", message: "Upload failed" },
      { status: 500 },
    );
  }
}
