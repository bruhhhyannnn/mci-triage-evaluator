import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptic } from '../lib/haptics';
import type { Tag } from '../lib/types';
import { TAG_LABEL } from '../lib/types';
import { Icon, type IconName } from './Icon';

// Components follow the Wireframe-to-Hi-fi Design System (Button, IconButton, StatusChip,
// SegmentedControl, SearchField, Card, BottomSheet, EmptyState), styled in styles.css.

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

export function IconButton({
  icon,
  label,
  onClick,
  variant = 'card',
  size = 48,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  variant?: 'card' | 'sunken' | 'primary' | 'plain';
  size?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${variant}`}
      style={{ width: size, height: size }}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={Math.round(size * 0.44)} />
    </button>
  );
}

export type ChipStatus = 'live' | 'pending' | 'stale' | 'error' | 'selected' | 'neutral';

export function StatusChip({ status = 'neutral', dot, children }: { status?: ChipStatus; dot?: boolean; children: ReactNode }) {
  const showDot = dot ?? (status === 'live' || status === 'pending' || status === 'stale' || status === 'error');
  return (
    <span className={`status-chip ${status}`}>
      {showDot && <span className="status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  role = 'tablist',
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  role?: 'tablist' | 'radiogroup';
  className?: string;
}) {
  const itemRole = role === 'tablist' ? 'tab' : 'radio';
  return (
    <div className={`segmented ${className}`} role={role} aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={itemRole}
            aria-selected={itemRole === 'tab' ? on : undefined}
            aria-checked={itemRole === 'radio' ? on : undefined}
            onClick={() => {
              if (!on) haptic('select');
              onChange(o.value);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  onSubmit,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  onSubmit?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className={`search-field ${invalid ? 'invalid' : ''}`}>
      <Icon name="search" size={20} />
      <input
        type="search"
        enterKeyHint="go"
        autoComplete="off"
        autoCapitalize="words"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {value && (
        <button type="button" className="search-clear" aria-label="Clear" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = 'search',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <div className="empty-title">{title}</div>
      {body && <div className="empty-body">{body}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
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
      {onBack ? <IconButton icon="chevron-left" label={backLabel} onClick={onBack} variant="card" size={44} /> : <span className="topbar-spacer" />}
      <div className="topbar-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right ?? <span className="topbar-spacer" />}
    </header>
  );
}

/** The design system's BottomSheet, used as a modal dialog. */
export function Sheet({
  open,
  title,
  eyebrow,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, button.btn, select')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <span className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
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
  const ask = (options: ConfirmOptions) => {
    if (options.danger) haptic('warning');
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  };
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const element = (
    <Sheet open={!!pending} title={pending?.title ?? ''} onClose={() => close(false)}>
      <div className="sheet-body">{pending?.message}</div>
      <div className="sheet-actions">
        <button type="button" className="btn outline" onClick={() => close(false)}>
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

/** Short message that fades on its own, optionally with one action (e.g. Undo). */
interface ToastMessage {
  text: string;
  action?: { label: string; onClick: () => void };
  key: number;
}
let toastListener: ((message: Omit<ToastMessage, 'key'>) => void) | null = null;
export function toast(text: string, action?: { label: string; onClick: () => void }) {
  toastListener?.({ text, action });
}

export function ToastHost() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  useEffect(() => {
    toastListener = (m) => setMessage({ ...m, key: Date.now() });
    return () => {
      toastListener = null;
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className={`toast ${message.action ? 'with-action' : ''}`} key={message.key}>
          <span>{message.text}</span>
          {message.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                message.action!.onClick();
                setMessage(null);
              }}
            >
              {message.action.label}
            </button>
          )}
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
    const onVisible = () => document.visibilityState === 'visible' && !cancelled && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
