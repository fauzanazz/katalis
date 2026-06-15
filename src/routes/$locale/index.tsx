import { createFileRoute } from "@tanstack/react-router";

import { HomeLanding } from "@/components/start/landing/HomeLanding";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/$locale/")({
  head: () => ({
    meta: [
      { title: m.metadata_title() },
      { name: "description", content: m.metadata_description() },
    ],
  }),
  component: Home,
});

function Home() {
  return <HomeLanding />;
}
