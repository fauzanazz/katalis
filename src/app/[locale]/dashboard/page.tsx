import { useTranslations } from "next-intl";
import { getSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale: "en" });
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const t = useTranslations();

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("common.appName")}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {t("landing.hero.subtitle")}
        </p>
      </div>
    </div>
  );
}
