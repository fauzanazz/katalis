import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const t = useTranslations("notFound");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <p className="text-6xl font-bold text-zinc-300 dark:text-zinc-700">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
        {t("description")}
      </p>
      <div className="mt-8">
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
