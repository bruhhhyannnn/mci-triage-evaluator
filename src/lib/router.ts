import { useSyncExternalStore } from 'react';
import type { Method } from './types';

export type Route =
  | { name: 'home' }
  /** Scoring screen. Without a method it runs the sheet's next unfinished method. */
  | { name: 'score'; id: string; method?: Method }
  | { name: 'sheet'; id: string }
  | { name: 'results' };

const METHODS = new Set(['START', 'SIEVE', 'SAVE', 'SORT']);

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [first, id, second] = parts;
  if (first === 'results') return { name: 'results' };
  if (first === 'e' && id) {
    if (second === 'results') return { name: 'sheet', id };
    if (second && METHODS.has(second)) return { name: 'score', id, method: second as Method };
    return { name: 'score', id };
  }
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'results':
      return '#/results';
    case 'score':
      return `#/e/${encodeURIComponent(route.id)}${route.method ? `/${route.method}` : ''}`;
    case 'sheet':
      return `#/e/${encodeURIComponent(route.id)}/results`;
  }
}

/** Adds a history entry so the phone's back button returns here. */
export function navigate(route: Route) {
  window.location.hash = href(route);
}

/** Swaps the current history entry, so Back skips screens that are done with. */
export function replace(route: Route) {
  const url = `${window.location.pathname}${window.location.search}${href(route)}`;
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}
