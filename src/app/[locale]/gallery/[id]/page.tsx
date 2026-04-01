import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GalleryDetailClient } from "./GalleryDetailClient";

interface GalleryDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

function safeParseJSON<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default async function GalleryDetailPage({
  params,
}: GalleryDetailPageProps) {
  const { id } = await params;

  const entry = await prisma.galleryEntry.findUnique({
    where: { id },
  });

  if (!entry) {
    notFound();
  }

  const coordinates = safeParseJSON<{ lat: number; lng: number } | null>(
    entry.coordinates,
    null,
  );
  const questContext = safeParseJSON<{
    questTitle?: string;
    dream?: string;
    missionSummaries?: string[];
  } | null>(entry.questContext, null);

  const entryData = {
    id: entry.id,
    imageUrl: entry.imageUrl,
    talentCategory: entry.talentCategory,
    country: entry.country,
    coordinates,
    questContext,
    createdAt: entry.createdAt.toISOString(),
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <GalleryDetailClient entry={entryData} />
    </div>
  );
}
