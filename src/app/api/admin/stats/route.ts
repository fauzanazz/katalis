import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, children, accessCodes, discoveries, quests, galleryEntries } from "@/lib/schema";
import { eq, count } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [
    totalUsersRows,
    totalChildrenRows,
    activeCodesRows,
    totalDiscoveriesRows,
    totalQuestsRows,
    totalGalleryEntriesRows,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(children),
    db.select({ count: count() }).from(accessCodes).where(eq(accessCodes.active, true)),
    db.select({ count: count() }).from(discoveries),
    db.select({ count: count() }).from(quests),
    db.select({ count: count() }).from(galleryEntries),
  ]);

  return NextResponse.json({
    totalUsers: totalUsersRows[0].count,
    totalChildren: totalChildrenRows[0].count,
    activeCodes: activeCodesRows[0].count,
    totalDiscoveries: totalDiscoveriesRows[0].count,
    totalQuests: totalQuestsRows[0].count,
    totalGalleryEntries: totalGalleryEntriesRows[0].count,
  });
}
