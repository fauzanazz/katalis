import { getTranslations } from "next-intl/server";
import { getUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllTips } from "@/lib/parent/home-tips";
import {
  Lightbulb,
  Wrench,
  Palette,
  BookOpen,
  Music,
  Microscope,
  Sparkles,
} from "lucide-react";

const CATEGORIES = [
  { slug: "all", label: "All Tips", icon: Lightbulb },
  { slug: "Engineering", label: "Engineering", icon: Wrench },
  { slug: "Art", label: "Art & Design", icon: Palette },
  { slug: "Narrative", label: "Storytelling", icon: BookOpen },
  { slug: "Music", label: "Music", icon: Music },
  { slug: "Science", label: "Science", icon: Microscope },
  { slug: "Creative", label: "Creative", icon: Sparkles },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "border-orange-200 bg-orange-50",
  Art: "border-pink-200 bg-pink-50",
  Narrative: "border-purple-200 bg-purple-50",
  Music: "border-blue-200 bg-blue-50",
  Science: "border-green-200 bg-green-50",
  Creative: "border-amber-200 bg-amber-50",
};

export default async function ParentTipsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const t = await getTranslations("parent.tips");
  const params = await searchParams;
  const activeCategory = params.category ?? "all";

  const tips =
    activeCategory === "all"
      ? getAllTips()
      : getAllTips(activeCategory);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Category filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.slug;
          return (
            <a
              key={cat.slug}
              href={`/parent/tips${cat.slug === "all" ? "" : `?category=${cat.slug}`}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="size-4" />
              {cat.label}
            </a>
          );
        })}
      </div>

      {/* Tips grid */}
      {tips.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {tips.map((tip, i) => {
            const colorClass = CATEGORY_COLORS[tip.category] ?? "border-border bg-background";
            return (
              <article
                key={i}
                className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${colorClass}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{tip.title}</h3>
                  <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {tip.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{tip.description}</p>
                {tip.materials.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t("materials")}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tip.materials.map((m, j) => (
                        <span
                          key={j}
                          className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-foreground"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="py-12 text-center text-muted-foreground">
          {t("noTips")}
        </p>
      )}
    </div>
  );
}
