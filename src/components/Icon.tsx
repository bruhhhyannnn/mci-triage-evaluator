import { createElement, type CSSProperties } from 'react';

// Lucide geometry (https://lucide.dev, ISC): 24px grid, 2px stroke, round caps and joins.
// Same approach as the design system's Icon component, trimmed to what this app uses.
type Node = ['path', { d: string }] | ['circle', { cx: number; cy: number; r: number }] | ['rect', { x: number; y: number; width: number; height: number; rx: number }];
const P = (d: string): Node => ['path', { d }];
const C = (cx: number, cy: number, r: number): Node => ['circle', { cx, cy, r }];
const R = (x: number, y: number, width: number, height: number, rx: number): Node => ['rect', { x, y, width, height, rx }];

const ICONS = {
  search: [C(11, 11, 8), P('m21 21-4.3-4.3')],
  x: [P('M18 6 6 18'), P('m6 6 12 12')],
  check: [P('M20 6 9 17l-5-5')],
  'chevron-left': [P('m15 18-6-6 6-6')],
  'chevron-right': [P('m9 18 6-6-6-6')],
  settings: [
    P(
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z',
    ),
    C(12, 12, 3),
  ],
  users: [P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'), C(9, 7, 4), P('M22 21v-2a4 4 0 0 0-3-3.87'), P('M16 3.13a4 4 0 0 1 0 7.75')],
  user: [P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'), C(12, 7, 4)],
  plus: [P('M12 5v14M5 12h14')],
  play: [P('M6 3 20 12 6 21 6 3Z')],
  pause: [R(14, 4, 4, 16, 1), R(6, 4, 4, 16, 1)],
  clock: [C(12, 12, 10), P('M12 6v6l4 2')],
  info: [C(12, 12, 10), P('M12 16v-4'), P('M12 8h.01')],
  'alert-triangle': [
    P('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'),
    P('M12 9v4'),
    P('M12 17h.01'),
  ],
  sun: [C(12, 12, 4), P('M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4')],
  moon: [P('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z')],
  smartphone: [R(5, 2, 14, 20, 2), P('M12 18h.01')],
  refresh: [
    P('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'),
    P('M21 3v5h-5'),
    P('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'),
    P('M8 16H3v5'),
  ],
  'clipboard-check': [
    R(8, 2, 8, 4, 1),
    P('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'),
    P('m9 14 2 2 4-4'),
  ],
  'chart-column': [P('M3 3v16a2 2 0 0 0 2 2h16'), P('M18 17V9'), P('M13 17V5'), P('M8 17v-3')],
  upload: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), P('m17 8-5-5-5 5'), P('M12 3v12')],
  download: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), P('m7 10 5 5 5-5'), P('M12 15V3')],
  'undo-2': [P('M9 14 4 9l5-5'), P('M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11')],
  'trash-2': [
    P('M3 6h18'),
    P('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'),
    P('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'),
    P('M10 11v6'),
    P('M14 11v6'),
  ],
  pencil: [
    P('M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'),
    P('m15 5 4 4'),
  ],
  timer: [P('M10 2h4'), P('M12 14l3-3'), C(12, 14, 8)],
  'file-spreadsheet': [
    P('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'),
    P('M14 2v4a2 2 0 0 0 2 2h4'),
    P('M8 13h2'),
    P('M14 13h2'),
    P('M8 17h2'),
    P('M14 17h2'),
  ],
  'rotate-ccw': [P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'), P('M3 3v5h5')],
  vibrate: [P('m2 8 2 2-2 2 2 2-2 2'), P('m22 8-2 2 2 2-2 2 2 2'), R(8, 5, 8, 14, 1)],
  'arrow-right': [P('M5 12h14'), P('m12 5 7 7-7 7')],
} satisfies Record<string, Node[]>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  stroke = 2,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      {(ICONS[name] as Node[]).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
