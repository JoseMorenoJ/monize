'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Tracks which section is currently visible in the viewport using IntersectionObserver.
 * Updates window.location.hash via replaceState (no history pollution).
 *
 * @param sectionIds - Array of element IDs to observe
 * @param options - Optional IntersectionObserver rootMargin
 * @returns The ID of the currently active (most visible near top) section
 */
export function useScrollSpy(
  sectionIds: readonly string[],
  { rootMargin = '-10% 0px -80% 0px', updateHash = true, enabled = true } = {},
): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.slice(1);
      if (sectionIds.includes(hash)) {
        return hash;
      }
    }
    return sectionIds[0] ?? '';
  });

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible) {
        const id = visible.target.id;
        setActiveId(id);
        if (updateHash) {
          window.history.replaceState(null, '', `#${id}`);
        }
      }
    },
    [updateHash],
  );

  useEffect(() => {
    if (!enabled) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin,
      threshold: 0,
    });

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [sectionIds, rootMargin, handleIntersect, enabled]);

  // Scroll to hash target when enabled transitions to true
  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.slice(1);
      const el = document.getElementById(hash);
      if (el?.scrollIntoView) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }, [enabled]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    if (updateHash) {
      window.history.replaceState(null, '', `#${id}`);
    }
  }, [updateHash]);

  return [activeId, setActive];
}
