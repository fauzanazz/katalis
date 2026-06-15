import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/$locale/terms")({
  head: () => ({
    meta: [{ title: m.legal_terms_title() }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article className="mx-auto max-w-prose px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {m.legal_terms_title()}
      </h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        {m.legal_terms_stub()}
      </p>
    </article>
  );
}
