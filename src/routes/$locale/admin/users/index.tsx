import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { BackButton } from "@/components/start/BackButton";
import { listAdminUsersFn } from "@/lib/server/admin-users";

export const Route = createFileRoute("/$locale/admin/users/")({
  loader: async ({ params }) => {
    const res = await listAdminUsersFn();
    if (!res.ok) {
      if (res.error === "unauthorized")
        throw redirect({ href: `/${params.locale}/parent` });
      throw notFound();
    }
    return { users: res.users };
  },
  component: AdminUsersPage,
});

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return m.admin_users_roleAdmin();
    case "ai":
      return m.admin_users_roleAi();
    default:
      return m.admin_users_roleUser();
  }
}

function AdminUsersPage() {
  const { users } = Route.useLoaderData();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold text-foreground">
          {m.admin_users_title()}
        </h1>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground">{m.admin_users_noUsers()}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {m.admin_users_name()}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {m.admin_users_email()}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {m.admin_users_role()}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {m.admin_users_createdAt()}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
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
