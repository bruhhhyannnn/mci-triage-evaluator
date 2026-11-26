import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Tag } from '../lib/types';
import { TAG_LABEL } from '../lib/types';

export function TagChip({ tag, size = 'md' }: { tag: Tag | undefined; size?: 'sm' | 'md' }) {
  if (!tag) return <span className={`tag-chip tag-none ${size}`}>Not tagged</span>;
  return <span className={`tag-chip tag-${tag.toLowerCase()} ${size}`}>{TAG_LABEL[tag]}</span>;
}

export function AcceptedTags({ tags }: { tags: Tag[] }) {
  return (
    <span className="accepted">
      {tags.map((t, i) => (
        <span key={t} className="accepted-item">
          {i > 0 && <span className="or">or</span>}
          <TagChip tag={t} size="sm" />
        </span>
      ))}
    </span>
  );
}

export function TopBar({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack ? (
        <button type="button" className="icon-btn" onClick={onBack} aria-label={backLabel}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="topbar-spacer" />
      )}
      <div className="topbar-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right ?? <span className="topbar-spacer" />}
    </header>
  );
}

export function Sheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button, input, select')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

/** In-app replacement for window.confirm that matches the rest of the UI. */
export function useConfirm() {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const element = (
    <Sheet open={!!pending} title={pending?.title ?? ''} onClose={() => close(false)}>
      <div className="sheet-body">{pending?.message}</div>
      <div className="sheet-actions">
        <button type="button" className="btn secondary" onClick={() => close(false)}>
          Cancel
        </button>
        <button type="button" className={`btn ${pending?.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>
          {pending?.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
  return { ask, element };
}

/** Short message at the bottom of the screen that fades on its own. */
let toastListener: ((text: string) => void) | null = null;
export function toast(text: string) {
  toastListener?.(text);
}

export function ToastHost() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    toastListener = (text) => setMessage({ text, key: Date.now() });
    return () => {
      toastListener = null;
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast" key={message.key}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);
  return active ? now : Date.now();
}

/** Keeps the phone screen on while the stopwatch runs (where the browser supports it). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    request();
    // The lock drops when the app is backgrounded; take it again on return.
    const onVisible = () => document.visibilityState === 'visible' && !cancelled && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
