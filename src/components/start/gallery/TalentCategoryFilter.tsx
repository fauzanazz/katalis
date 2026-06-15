import { m } from "@/paraglide/messages";
import { getTalentCategoryColor } from "@/types/gallery";

interface TalentCategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function TalentCategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
}: TalentCategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <div className="mb-4" role="region" aria-label={m.gallery_filter_ariaLabel()}>
      <label className="mb-2 block text-sm font-medium text-muted-foreground">
        {m.gallery_filter_label()}
      </label>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={m.gallery_filter_ariaLabel()}
      >
        {/* "All" button */}
        <button
          role="tab"
          aria-selected={selectedCategory === null}
          aria-label={m.gallery_filter_all()}
          onClick={() => onCategoryChange(null)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedCategory === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {m.gallery_filter_all()}
        </button>

        {/* Category buttons */}
        {categories.map((category) => (
          <button
            key={category}
            role="tab"
            aria-selected={selectedCategory === category}
            aria-label={`${m.gallery_filter_label()}: ${category}`}
            onClick={() =>
              onCategoryChange(selectedCategory === category ? null : category)
            }
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === category
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getTalentCategoryColor(category) }}
              aria-hidden="true"
            />
            {category}
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {selectedCategory && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {m.gallery_filter_showing({ category: selectedCategory })}
          </p>
          <button
            onClick={() => onCategoryChange(null)}
            className="text-xs font-medium text-primary underline hover:text-primary/80"
            aria-label={m.gallery_filter_clearFilter()}
          >
            {m.gallery_filter_clearFilter()}
          </button>
        </div>
      )}
    </div>
  );
}
