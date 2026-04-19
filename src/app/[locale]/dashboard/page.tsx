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
    <div
      className="flex flex-1 flex-col items-center justify-center bg-background px-4"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">
          {t("common.appName")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("landing.hero.subtitle")}
        </p>
      </div>
    </div>
  );
}
