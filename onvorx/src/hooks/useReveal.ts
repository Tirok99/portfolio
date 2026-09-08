import { useEffect, useRef, useState } from "react";

interface RevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Adds an `is-visible` state once the element scrolls into view.
 * Respects prefers-reduced-motion (reveals immediately).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  /* fire as soon as a sliver crosses the trigger line so the motion
     resolves while the element scrolls into a comfortable reading spot */
  threshold = 0.04,
  rootMargin = "0px 0px -12% 0px",
  once = true,
}: RevealOptions = {}) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, visible };
}
