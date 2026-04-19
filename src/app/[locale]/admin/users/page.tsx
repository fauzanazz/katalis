import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { BackButton } from "@/components/layout/BackButton";

export default async function AdminUsersPage() {
  const t = await getTranslations("admin.users");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return t("roleAdmin");
      case "ai": return t("roleAi");
      default: return t("roleUser");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground">{t("noUsers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("name")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("email")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("role")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("createdAt")}</th>
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
                    {user.createdAt.toLocaleDateString()}
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
