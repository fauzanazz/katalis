import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$locale/login/")({
  validateSearch: (s) => ({
    callbackUrl: typeof s.callbackUrl === "string" ? s.callbackUrl : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      href: `/${params.locale}/login/parent${search.callbackUrl ? `?callbackUrl=${encodeURIComponent(search.callbackUrl)}` : ""}`,
    });
  },
});
