import { useTranslations } from "next-intl";
import { getSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-100 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-amber-900">
          {t("common.appName")}
        </h1>
        <p className="mt-2 text-amber-700">
          {t("landing.hero.subtitle")}
        </p>
      </div>
    </div>
  );
}
