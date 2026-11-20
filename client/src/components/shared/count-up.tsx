"use client";

import { useEffect, useRef, useState } from "react";

/** Animates once from 0 to `value` (SPEC 3 motion), instantly with reduced motion. */
export function CountUp({ value, locale }: { value: number; locale: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = reduce || value === 0 ? 1 : Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span ref={ref} className="tabular-nums">
      {new Intl.NumberFormat(locale === "en" ? "en-GB" : "sq-AL").format(shown)}
    </span>
  );
}
