import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { interestSignals, discoveries, discoveryRatings } from "@/lib/schema";
import { eq, isNotNull, count } from "drizzle-orm";
import { findNextUnratedDiscoveryForUser } from "@/lib/reliability/repository";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { INTEREST_TAXONOMY_V1 } from "@/lib/interests/taxonomy";
import { TAG_CATEGORIES } from "@/lib/ai/tag-schemas";
import { RatingForm } from "./RatingForm";

export default async function RateDiscoveryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const admin = await getAdminSession();
  if (!admin) {
    redirect({ href: "/parent", locale });
  }

  const discovery = await findNextUnratedDiscoveryForUser(admin!.userId);
  if (!discovery) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-xl font-bold text-foreground">All caught up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No discoveries left for you to rate. Check back after more activity
          comes in.
        </p>
        <Link
          href="/admin/reliability"
          className="mt-6 inline-block text-sm font-medium text-foreground underline"
        >
          ← Back to reliability dashboard
        </Link>
      </div>
    );
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
          if (
            entry &&
            typeof entry === "object" &&
            typeof entry.category === "string"
          ) {
            set.add(entry.category);
          }
        }
        aiTagCategories = [...set];
      }
    } catch {
      // ignore malformed JSON
    }
  }

  const ratedByUser = await db.query.discoveryRatings.findMany({
    where: eq(discoveryRatings.raterUserId, admin!.userId),
    columns: { discoveryId: true },
  });
  const ratedIds = new Set(ratedByUser.map((r) => r.discoveryId));
  const allEligible = await db.select({ count: count() }).from(discoveries).where(isNotNull(discoveries.detectedTalents));
  const remaining = (allEligible[0]?.count ?? 0) - ratedIds.size;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-foreground">Rate discovery</h1>
        <span className="text-xs text-muted-foreground">
          {remaining} remaining in queue
        </span>
      </header>

      <section className="mb-6 rounded-xl border border-border/60 bg-background p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Artifact</h2>
        <div className="mt-2 text-xs text-muted-foreground">
          ID: <span className="font-mono">{discovery.id}</span> · type:{" "}
          {discovery.type} · child: {discovery.childId}
        </div>
        {discovery.fileUrl ? (
          discovery.type === "artifact" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={discovery.fileUrl}
              alt="Discovery artifact"
              className="mt-3 max-h-96 rounded-md border border-border/40 object-contain"
            />
          ) : (
            <a
              href={discovery.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-foreground underline"
            >
              Open file
            </a>
          )
        ) : null}
      </section>

      <RatingForm
        discoveryId={discovery.id}
        aiInterestKeys={aiInterestKeys}
        aiTagCategories={aiTagCategories}
        allInterestKeys={[...INTEREST_TAXONOMY_V1]}
        allTagCategories={[...TAG_CATEGORIES]}
      />
    </div>
  );
}
