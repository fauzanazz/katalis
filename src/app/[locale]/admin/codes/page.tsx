import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { BackButton } from "@/components/layout/BackButton";
import { CreateCodeButton } from "./CreateCodeButton";

export default async function AdminCodesPage() {
  const t = await getTranslations("admin.codes");
  const codes = await prisma.accessCode.findMany({
    select: {
      id: true,
      code: true,
      active: true,
      expiresAt: true,
      createdAt: true,
      _count: { select: { children: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <CreateCodeButton />
      </div>

      {codes.length === 0 ? (
        <p className="text-muted-foreground">{t("noCodes")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("code")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("status")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("children")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("expiresAt")}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((ac) => (
                <tr key={ac.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{ac.code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ac.active
                        ? "bg-green-50 text-green-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {ac.active ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ac._count.children}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ac.expiresAt ? ac.expiresAt.toLocaleDateString() : t("noExpiry")}
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
