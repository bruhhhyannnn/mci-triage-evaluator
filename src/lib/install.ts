import { useSyncExternalStore } from 'react';

/**
 * "Install the app" support.
 * - Chrome/Edge on Android and desktop fire `beforeinstallprompt`; we keep it and show our own button.
 * - iPhone/iPad Safari has no prompt, so we show the Share → Add to Home Screen steps.
 * Installing matters here: scores live only on the device, and Safari can clear a website's
 * storage after 7 days without a visit unless it was added to the Home Screen.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    installed ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS reports itself as a Mac with touch.
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export type InstallMode = 'prompt' | 'ios' | null;

function currentMode(): InstallMode {
  if (isStandalone()) return null;
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return null;
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    currentMode,
    () => null,
  );
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const choice = await event.userChoice;
  notify();
  return choice.outcome === 'accepted';
}

/** Asks the browser not to clear this app's storage when space runs low. Silent if unsupported. */
export function requestPersistentStorage() {
  navigator.storage
    ?.persisted?.()
    .then((already) => (already ? true : navigator.storage.persist?.()))
    .catch(() => {});
}
