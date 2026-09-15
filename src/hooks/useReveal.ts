import { useEffect, useRef } from 'react';

/**
 * Fade-and-rise a block into view the first time it is scrolled to.
 *
 * An IntersectionObserver rather than a scroll library: it is a handful of
 * lines, it costs nothing, and it degrades to "everything is simply visible"
 * when the browser or the reader's motion preference says no.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduced || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
