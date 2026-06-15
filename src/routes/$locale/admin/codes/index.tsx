import { createFileRoute, redirect, notFound } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";
import { BackButton } from "@/components/start/BackButton";
import { CreateCodeButton } from "@/components/start/admin/CreateCodeButton";
import { listAccessCodesFn } from "@/lib/server/admin-codes";
import type { AccessCodeView } from "@/lib/server/admin-codes";

export const Route = createFileRoute("/$locale/admin/codes/")({
  loader: async ({ params }) => {
    const res = await listAccessCodesFn({ data: {} });
    if (!res.ok) {
      if (res.error === "unauthorized") throw redirect({ href: `/${params.locale}/parent` });
      throw notFound();
    }
    return { codes: res.codes };
  },
  component: AdminCodesPage,
});

function AdminCodesPage() {
  const { codes } = Route.useLoaderData();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">{m.admin_codes_title()}</h1>
        </div>
        <CreateCodeButton />
      </div>

      {codes.length === 0 ? (
        <p className="text-muted-foreground">{m.admin_codes_noCodes()}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_codes_code()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_codes_status()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_codes_children()}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{m.admin_codes_expiresAt()}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((ac: AccessCodeView) => (
                <tr key={ac.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{ac.code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ac.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {ac.active ? m.admin_codes_active() : m.admin_codes_inactive()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ac.childCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ac.expiresAt ? new Date(ac.expiresAt).toLocaleDateString() : m.admin_codes_noExpiry()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
