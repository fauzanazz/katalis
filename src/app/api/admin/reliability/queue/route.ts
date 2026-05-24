import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interestSignals, discoveries, discoveryRatings } from "@/lib/schema";
import { eq, isNotNull, notInArray, and, count } from "drizzle-orm";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { findNextUnratedDiscoveryForUser } from "@/lib/reliability/repository";

export async function GET(request: NextRequest) {
  const auth = await authorizeReliabilityRequest(request);
  if (!auth.ok || auth.via !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const discovery = await findNextUnratedDiscoveryForUser(auth.userId);
  if (!discovery) {
    return NextResponse.json({ discovery: null, remaining: 0 });
  }

  const signals = await db.query.interestSignals.findMany({
    where: eq(interestSignals.discoveryId, discovery.id),
    columns: { interestKey: true },
  });
  const aiInterestKeys = [
    ...new Set(signals.map((s) => s.interestKey).filter(Boolean)),
  ];

  let aiTagCategories: string[] = [];
  if (discovery.detectedTalents) {
    try {
      const parsed = JSON.parse(discovery.detectedTalents);
      if (Array.isArray(parsed)) {
        const set = new Set<string>();
        for (const entry of parsed) {
          if (entry && typeof entry === "object" && typeof entry.category === "string") {
            set.add(entry.category);
          }
        }
        aiTagCategories = [...set];
      }
    } catch {
      // ignore malformed JSON; leave aiTagCategories empty.
    }
  }

  const ratedByUser = await db.query.discoveryRatings.findMany({
    where: eq(discoveryRatings.raterUserId, auth.userId),
    columns: { discoveryId: true },
  });
  const ratedIds = ratedByUser.map((r) => r.discoveryId);

  const remainingWhere =
    ratedIds.length > 0
      ? and(isNotNull(discoveries.detectedTalents), notInArray(discoveries.id, ratedIds))
      : isNotNull(discoveries.detectedTalents);

  const remainingRows = await db
    .select({ count: count() })
    .from(discoveries)
    .where(remainingWhere);

  const remaining = remainingRows[0].count;

  return NextResponse.json({
    discovery: {
      id: discovery.id,
      childId: discovery.childId,
      type: discovery.type,
      fileUrl: discovery.fileUrl,
      createdAt: discovery.createdAt,
    },
    aiPredictions: {
      interestKeys: aiInterestKeys,
      tagCategories: aiTagCategories,
    },
    remaining,
  });
}
