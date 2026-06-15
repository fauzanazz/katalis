import { createFileRoute } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/$locale/contact")({
  head: () => ({
    meta: [{ title: m.legal_contact_title() }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <article className="mx-auto max-w-prose px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {m.legal_contact_title()}
      </h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        {m.legal_contact_stub()}
      </p>
      <p className="mt-8">
        <a
          href={m.legal_contact_emailHref()}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {m.legal_contact_emailCta()}
        </a>
      </p>
    </article>
  );
}
