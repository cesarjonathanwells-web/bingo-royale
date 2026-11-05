import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
let mediaQuery: MediaQueryList | null = null;
const subscribers = new Set<() => void>();

function getMediaQuery(): MediaQueryList | null {
  if (mediaQuery) return mediaQuery;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  mediaQuery = window.matchMedia(QUERY);
  return mediaQuery;
}

function notifySubscribers() {
  subscribers.forEach(notify => notify());
}

function subscribe(notify: () => void): () => void {
  const query = getMediaQuery();
  subscribers.add(notify);
  // Every board cell shares this store and one native change listener.
  if (query && subscribers.size === 1) {
    if (typeof query.addEventListener === "function") query.addEventListener("change", notifySubscribers);
    else query.addListener(notifySubscribers);
  }
  return () => {
    subscribers.delete(notify);
    if (query && subscribers.size === 0) {
      if (typeof query.removeEventListener === "function") query.removeEventListener("change", notifySubscribers);
      else query.removeListener(notifySubscribers);
    }
  };
}

function getSnapshot(): boolean {
  // Missing browser support uses the quieter, accessible presentation.
  return getMediaQuery()?.matches ?? true;
}

function getServerSnapshot(): boolean {
  return true;
}

/** Reacts to OS/browser preference changes without requiring a page reload. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
