import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mentorMessages, reflectionEntries, discoveries, interestSignals, rateLimits } from "@/lib/schema";
import { lt } from "drizzle-orm";
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
  const deletedMentorMessages = await db
    .delete(mentorMessages)
    .where(lt(mentorMessages.createdAt, cutoff(180)))
    .returning({ id: mentorMessages.id });

  // 2. Reflection entries with file URLs (delete R2 files first)
  const reflectionsWithFiles = await db.query.reflectionEntries.findMany({
    where: (t, { and, lt: ltOp, isNotNull: isNotNullOp }) =>
      and(ltOp(t.createdAt, cutoff(365)), isNotNullOp(t.fileUrl)),
    columns: { fileUrl: true },
  });
  await Promise.all(
    reflectionsWithFiles.map((r) => deleteR2File(r.fileUrl as string)),
  );

  // 3. Delete all old reflection entries
  const deletedReflections = await db
    .delete(reflectionEntries)
    .where(lt(reflectionEntries.createdAt, cutoff(365)))
    .returning({ id: reflectionEntries.id });

  // 4. Discoveries with file URLs (delete R2 files first)
  const discoveriesWithFiles = await db.query.discoveries.findMany({
    where: (t, { and, lt: ltOp, isNotNull: isNotNullOp }) =>
      and(ltOp(t.createdAt, cutoff(365)), isNotNullOp(t.fileUrl)),
    columns: { fileUrl: true },
  });
  await Promise.all(
    discoveriesWithFiles.map((d) => deleteR2File(d.fileUrl as string)),
  );

  // 5. Delete all old discoveries
  const deletedDiscoveries = await db
    .delete(discoveries)
    .where(lt(discoveries.createdAt, cutoff(365)))
    .returning({ id: discoveries.id });

  // 6. Interest signals older than 730 days
  const deletedInterestSignals = await db
    .delete(interestSignals)
    .where(lt(interestSignals.observedAt, cutoff(730)))
    .returning({ id: interestSignals.id });

  // 7. Expired rate limits
  const deletedRateLimits = await db
    .delete(rateLimits)
    .where(lt(rateLimits.resetAt, now))
    .returning({ id: rateLimits.id });

  return NextResponse.json({
    purged: {
      mentorMessages: deletedMentorMessages.length,
      reflections: deletedReflections.length,
      discoveries: deletedDiscoveries.length,
      interestSignals: deletedInterestSignals.length,
      rateLimits: deletedRateLimits.length,
    },
  });
}

// Vercel Cron can probe via GET
export async function GET(request: NextRequest) {
  return POST(request);
}
