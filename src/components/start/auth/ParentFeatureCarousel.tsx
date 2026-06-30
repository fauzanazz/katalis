import { useState, useEffect, useCallback } from "react";
import { m } from "@/paraglide/messages";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    image: "/images/features/parent-bridge.webp",
    title: () => m.auth_parent_features_feature1Title(),
    desc: () => m.auth_parent_features_feature1Desc(),
  },
  {
    image: "/images/features/talent-scout.webp",
    title: () => m.auth_parent_features_feature2Title(),
    desc: () => m.auth_parent_features_feature2Desc(),
  },
  {
    image: "/images/features/squad-gallery.webp",
    title: () => m.auth_parent_features_feature3Title(),
    desc: () => m.auth_parent_features_feature3Desc(),
  },
  {
    image: "/images/features/quest-buddy.webp",
    title: () => m.auth_parent_features_feature4Title(),
    desc: () => m.auth_parent_features_feature4Desc(),
  },
] as const;

export function ParentFeatureCarousel() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (animating) return;
      setAnimating(true);
      setActive(index);
      setTimeout(() => setAnimating(false), 500);
    },
    [animating],
  );

  const prev = useCallback(() => {
    goTo((active - 1 + SLIDES.length) % SLIDES.length);
  }, [active, goTo]);

  const next = useCallback(() => {
    goTo((active + 1) % SLIDES.length);
  }, [active, goTo]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[active];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Slides */}
      {SLIDES.map((s, i) => (
        <div
          key={s.image}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: i === active ? 1 : 0 }}
          aria-hidden={i !== active}
        >
          <img
            src={s.image}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            decoding={i === 0 ? "sync" : "async"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}

      {/* Top gradient + vision text */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-black/90 via-black/65 to-transparent" />
      <div className="absolute inset-x-0 top-0 px-8 pt-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-white [text-shadow:0_1px_8px_rgba(0,0,0,1)]">Katalis</p>
        <h2 className="mt-1 font-display text-xl font-bold leading-snug !text-white [text-shadow:0_2px_12px_rgba(0,0,0,1),0_0_40px_rgba(0,0,0,0.8)]">{m.auth_parent_features_heading()}</h2>
        <p className="mt-1 text-xs leading-relaxed text-white [text-shadow:0_1px_8px_rgba(0,0,0,1)]">{m.auth_parent_features_vision()}</p>
      </div>

      {/* Bottom gradient + feature text */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-8 pb-16">
        <p className="text-lg font-bold text-white">{slide.title()}</p>
        <p className="mt-1 text-sm leading-relaxed text-white">{slide.desc()}</p>
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-6 py-4">
        <button
          onClick={prev}
          className="flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/35"
          aria-label="Previous"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/35"
          aria-label="Next"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
