import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getAdminSessionFn } from "@/lib/server/admin-auth";

export const Route = createFileRoute("/$locale/admin")({
  beforeLoad: async ({ params }) => {
    const admin = await getAdminSessionFn();
    if (!admin) throw redirect({ href: `/${params.locale}/parent` });
  },
  component: () => <Outlet />,
});
