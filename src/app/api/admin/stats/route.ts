import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [
    totalUsers,
    totalChildren,
    activeCodes,
    totalDiscoveries,
    totalQuests,
    totalGalleryEntries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.child.count(),
    prisma.accessCode.count({ where: { active: true } }),
    prisma.discovery.count(),
    prisma.quest.count(),
    prisma.galleryEntry.count(),
  ]);

  return NextResponse.json({
    totalUsers,
    totalChildren,
    activeCodes,
    totalDiscoveries,
    totalQuests,
    totalGalleryEntries,
  });
}
