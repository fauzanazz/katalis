import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorageClient } from "@/lib/storage";
import { authorizeRetentionRequest } from "../auth";

const DAYS_MS = (d: number) => d * 24 * 60 * 60 * 1000;

function cutoff(daysBack: number): Date {
  return new Date(Date.now() - DAYS_MS(daysBack));
}

async function deleteR2File(fileUrl: string): Promise<void> {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) return;
  const key = fileUrl.replace(`${publicUrl}/`, "");
  try {
    await getStorageClient().deleteFile(key);
  } catch (err) {
    console.error(`[data-retention] Failed to delete R2 key ${key}:`, err);
  }
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeRetentionRequest(request);
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. Mentor messages older than 180 days
  const { count: mentorMessages } = await prisma.mentorMessage.deleteMany({
    where: { createdAt: { lt: cutoff(180) } },
  });

  // 2. Reflection entries with file URLs (delete R2 files first)
  const reflectionsWithFiles = await prisma.reflectionEntry.findMany({
    where: { createdAt: { lt: cutoff(365) }, fileUrl: { not: null } },
    select: { fileUrl: true },
  });
  await Promise.all(
    reflectionsWithFiles.map((r) => deleteR2File(r.fileUrl as string)),
  );

  // 3. Delete all old reflection entries
  const { count: reflections } = await prisma.reflectionEntry.deleteMany({
    where: { createdAt: { lt: cutoff(365) } },
  });

  // 4. Discoveries with file URLs (delete R2 files first)
  const discoveriesWithFiles = await prisma.discovery.findMany({
    where: { createdAt: { lt: cutoff(365) }, fileUrl: { not: null } },
    select: { fileUrl: true },
  });
  await Promise.all(
    discoveriesWithFiles.map((d) => deleteR2File(d.fileUrl as string)),
  );

  // 5. Delete all old discoveries
  const { count: discoveries } = await prisma.discovery.deleteMany({
    where: { createdAt: { lt: cutoff(365) } },
  });

  // 6. Interest signals older than 730 days
  const { count: interestSignals } = await prisma.interestSignal.deleteMany({
    where: { observedAt: { lt: cutoff(730) } },
  });

  // 7. Expired rate limits
  const { count: rateLimits } = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: now } },
  });

  return NextResponse.json({
    purged: {
      mentorMessages,
      reflections,
      discoveries,
      interestSignals,
      rateLimits,
    },
  });
}

// Vercel Cron can probe via GET
export async function GET(request: NextRequest) {
  return POST(request);
}
