import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

  const signals = await prisma.interestSignal.findMany({
    where: { discoveryId: discovery.id },
    select: { interestKey: true },
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

  const remaining = await prisma.discovery.count({
    where: {
      detectedTalents: { not: null },
      ratings: { none: { raterUserId: auth.userId } },
    },
  });

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
