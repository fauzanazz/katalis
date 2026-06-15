import { createFileRoute, notFound } from "@tanstack/react-router";
import { GalleryDetailClient } from "@/components/start/gallery/GalleryDetailClient";
import { getGalleryEntryFn } from "@/lib/server/gallery";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/$locale/gallery/$id")({
  loader: async ({ params }) => {
    const result = await getGalleryEntryFn({ data: { id: params.id } });
    if (!result.ok) {
      if (result.error === "not_found") throw notFound();
      throw notFound();
    }
    return {
      entry: {
        id: result.id,
        imageUrl: result.imageUrl,
        talentCategory: result.talentCategory,
        country: result.country,
        coordinates: result.coordinates,
        questContext: result.questContext,
        createdAt: result.createdAt,
      },
    };
  },
  head: () => ({
    meta: [{ title: m.gallery_title() }],
  }),
  component: GalleryDetailPage,
});

function GalleryDetailPage() {
  const { entry } = Route.useLoaderData();
  return (
    <div className="container mx-auto px-4 py-6">
      <GalleryDetailClient entry={entry} />
    </div>
  );
}
