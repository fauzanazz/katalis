import { NextRequest, NextResponse } from "next/server";
import { getStorageClient } from "@/lib/storage";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";

const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const auth = await authorizeReliabilityRequest(request, {
    allowCronSecret: true,
  });
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const storage = getStorageClient();
  const cutoff = new Date(Date.now() - GUEST_TTL_MS);

  const objects = await storage.listObjects("guest/");
  const stale = objects.filter((o) => o.lastModified < cutoff);

  await Promise.allSettled(stale.map((o) => storage.deleteFile(o.key)));

  return NextResponse.json({ deleted: stale.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
