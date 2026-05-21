"use client";

import { useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface PillTagProps {
  label: string;
  className?: string;
}

const EASE = "power2.inOut";

export function PillTag({ label, className }: PillTagProps) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const circleRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const whiteRef = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);

  const buildTimeline = useCallback(() => {
    const pill = pillRef.current;
    const circle = circleRef.current;
    const label = labelRef.current;
    const white = whiteRef.current;
    if (!pill || !circle || !label || !white) return;

    const w = pill.offsetWidth;
    const h = pill.offsetHeight;

    const R = ((w * w) / 4 + h * h) / (2 * h);
    const D = Math.ceil(2 * R) + 2;
    const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;

    tlRef.current?.kill();

    gsap.set(circle, {
      width: D,
      height: D,
      bottom: -delta,
      left: "50%",
      xPercent: -50,
      scale: 0,
      transformOrigin: `50% ${D - delta}px`,
      borderRadius: "50%",
    });

    gsap.set(label, { y: 0 });
    gsap.set(white, { y: h + 12, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease: EASE }, 0);
    tl.to(label, { y: -(h + 8), duration: 2, ease: EASE }, 0);
    tl.to(white, { y: 0, opacity: 1, duration: 2, ease: EASE }, 0);
    tlRef.current = tl;
  }, []);

  useEffect(() => {
    buildTimeline();
    window.addEventListener("resize", buildTimeline);
    document.fonts.ready.then(buildTimeline);
    return () => {
      window.removeEventListener("resize", buildTimeline);
      tlRef.current?.kill();
    };
  }, [buildTimeline]);

  const handleEnter = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    activeTweenRef.current?.kill();
    activeTweenRef.current = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease: EASE,
      overwrite: "auto",
    });
  }, []);

  const handleLeave = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    activeTweenRef.current?.kill();
    activeTweenRef.current = tl.tweenTo(0, {
      duration: 0.2,
      ease: EASE,
      overwrite: "auto",
    });
  }, []);

  return (
    <span
      ref={pillRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={cn(
        "relative inline-flex cursor-default select-none items-center overflow-hidden rounded-md px-3 py-1.5 text-[11.5px] font-bold sm:text-xs md:text-sm",
        className,
      )}
    >
      <span
        ref={circleRef}
        aria-hidden
        className="pointer-events-none absolute bg-ink"
      />
      <span ref={labelRef} className="relative z-10">
        {label}
      </span>
      <span
        ref={whiteRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-white"
      >
        {label}
      </span>
    </span>
  );
}
