/**
 * Haptic feedback that works on both phone platforms:
 * - Android (Chrome, Edge, Samsung Internet): the Vibration API, with patterns.
 * - iPhone (Safari / home-screen app, iOS 18+): no Vibration API, but toggling a native
 *   `<input type="checkbox" switch>` plays the system haptic. One tick per call, and it
 *   only fires inside a tap handler, which is where every call here comes from.
 * Elsewhere it does nothing.
 */
export type HapticKind = 'select' | 'tap' | 'start' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  select: 8,
  tap: 14,
  start: 28,
  success: [18, 70, 18],
  warning: [30, 60, 30, 60, 30],
};

let enabled = true;
let iosSwitch: HTMLLabelElement | null = null;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function iosTick() {
  if (typeof document === 'undefined') return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind: HapticKind = 'tap') {
  if (!enabled) return;
  try {
    if (canVibrate()) navigator.vibrate(PATTERNS[kind]);
    else iosTick();
  } catch {
    // Haptics are a nicety; never let them break a tap.
  }
}

/** True on devices where we can expect a haptic (used to explain the setting). */
export function hapticsSupported(): boolean {
  if (canVibrate()) return true;
  return typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
}
