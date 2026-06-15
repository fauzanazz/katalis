import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { LocaleLink } from "@/i18n/start-navigation";
import { getNextUnratedDiscoveryFn } from "@/lib/server/admin-reliability";
import { RatingForm } from "@/components/start/admin/RatingForm";

export const Route = createFileRoute("/$locale/admin/reliability/rate/")({
  loader: async ({ params }) => {
    const res = await getNextUnratedDiscoveryFn();
    if (!res.ok) {
      if (res.error === "unauthorized")
        throw redirect({ href: `/${params.locale}/parent` });
      throw notFound();
    }
    return {
      discovery: res.discovery,
      aiPredictions: res.aiPredictions,
      remaining: res.remaining,
      allInterestKeys: res.allInterestKeys,
      allTagCategories: res.allTagCategories,
    };
  },
  component: RateDiscoveryPage,
});

function RateDiscoveryPage() {
  const { discovery, aiPredictions, remaining, allInterestKeys, allTagCategories } =
    Route.useLoaderData();

  if (!discovery) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-xl font-bold text-foreground">All caught up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No discoveries left for you to rate. Check back after more activity
          comes in.
        </p>
        <LocaleLink
          href="/admin/reliability"
          className="mt-6 inline-block text-sm font-medium text-foreground underline"
        >
          ← Back to reliability dashboard
        </LocaleLink>
      </div>
    );
  }

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
        aiInterestKeys={aiPredictions.interestKeys}
        aiTagCategories={aiPredictions.tagCategories}
        allInterestKeys={allInterestKeys}
        allTagCategories={allTagCategories}
      />
    </div>
  );
}
