import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import Image from "next/image";

export default async function NotFoundPage() {
  const t = await getTranslations("notFound");
  let session = null;
  try {
    session = await getSession();
  } catch {
    // session unavailable in some not-found contexts
  }

  let backHref: string;
  let backLabel: string;

  if (session?.type === "child") {
    backHref = "/discover";
    backLabel = t("backToDiscovery");
  } else if (session?.type === "user") {
    backHref = "/parent";
    backLabel = t("backToDashboard");
  } else {
    backHref = "/";
    backLabel = t("backHome");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-6">
        <Image
          src="/images/404-mascot.png"
          alt="Kit mascot holding a forbidden sign"
          fill
          className="object-contain"
          priority
        />
      </div>

      <h1 className="text-2xl font-bold text-ink text-center">
        {t("title")}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground max-w-xs">
        {t("description")}
      </p>

      <div className="mt-8">
        <Button asChild variant="default" size="lg" className="min-h-[44px] rounded-full px-8 font-semibold">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
