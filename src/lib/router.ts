import { useSyncExternalStore } from 'react';
import type { Method } from './types';

export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'trainee' }
  | { name: 'run'; id: string; method: Method }
  | { name: 'review'; id: string; method: Method }
  | { name: 'summary'; id: string }
  | { name: 'records' }
  | { name: 'roster' };

const METHODS = new Set(['START', 'SIEVE', 'SAVE', 'SORT']);

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [first, id, method, extra] = parts;
  switch (first) {
    case undefined:
      return { name: 'home' };
    case 'setup':
      return { name: 'setup' };
    case 'trainee':
      return { name: 'trainee' };
    case 'records':
      return { name: 'records' };
    case 'roster':
      return { name: 'roster' };
    case 'e':
      if (!id) break;
      if (method === 'summary') return { name: 'summary', id };
      if (method && METHODS.has(method)) {
        return extra === 'review'
          ? { name: 'review', id, method: method as Method }
          : { name: 'run', id, method: method as Method };
      }
      return { name: 'summary', id };
  }
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'run':
      return `#/e/${encodeURIComponent(route.id)}/${route.method}`;
    case 'review':
      return `#/e/${encodeURIComponent(route.id)}/${route.method}/review`;
    case 'summary':
      return `#/e/${encodeURIComponent(route.id)}/summary`;
    default:
      return `#/${route.name}`;
  }
}

/** Adds a history entry so the phone's back button returns here. */
export function navigate(route: Route) {
  window.location.hash = href(route);
}

/** Swaps the current history entry, e.g. so Back skips a finished timer screen. */
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
