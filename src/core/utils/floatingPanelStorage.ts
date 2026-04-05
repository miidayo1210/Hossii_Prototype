export type FloatingRect = { x: number; y: number; w: number; h: number };

const PREFIX = 'hossii.floatingPanel.';

/** モバイル下部ナビ（BottomNavBar）分の余白。パネル下端がナビに潜まないようにする */
export const MOBILE_BOTTOM_NAV_RESERVE_PX = 72;

export function getFloatingPanelBottomInsetPx(): number {
  if (typeof window === 'undefined') return 0;
  return window.innerWidth <= 768 ? MOBILE_BOTTOM_NAV_RESERVE_PX : 0;
}

export function loadFloatingRect(key: string, fallback: FloatingRect): FloatingRect {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<FloatingRect>;
    if (
      typeof p.x !== 'number' ||
      typeof p.y !== 'number' ||
      typeof p.w !== 'number' ||
      typeof p.h !== 'number' ||
      !Number.isFinite(p.x + p.y + p.w + p.h)
    ) {
      return fallback;
    }
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  } catch {
    return fallback;
  }
}

export function saveFloatingRect(key: string, rect: FloatingRect): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(rect));
  } catch {
    /* quota / private mode */
  }
}

export function clampFloatingRect(
  rect: FloatingRect,
  vw: number,
  vh: number,
  minW: number,
  minH: number,
  maxW?: number,
  maxH?: number,
  bottomInset = 0
): FloatingRect {
  let { x, y, w, h } = rect;
  const innerVh = Math.max(0, vh - bottomInset);
  const heightCap = Math.min(maxH ?? innerVh, innerVh);
  w = Math.max(minW, Math.min(maxW ?? vw, w));
  h = Math.max(minH, Math.min(heightCap, h));
  x = Math.max(0, Math.min(vw - w, x));
  const maxY = Math.max(0, vh - h - bottomInset);
  y = Math.max(0, Math.min(maxY, y));
  return { x, y, w, h };
}

const TOP_BAR = 64; /* 4rem */

export function getDefaultSpeechRect(): FloatingRect {
  if (typeof window === 'undefined') return { x: 88, y: 400, w: 480, h: 280 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const reserve = getFloatingPanelBottomInsetPx();
  const leftInset = 88; /* ~5.5rem */
  const rightInset = 12;
  const w = Math.min(560, vw - leftInset - rightInset);
  const h = Math.min(Math.floor(vh * 0.4), 360);
  const x = leftInset + Math.max(0, (vw - leftInset - rightInset - w) / 2);
  const y = vh - h - reserve;
  return { x, y, w, h };
}

export function getDefaultQuickPostSideRect(): FloatingRect {
  if (typeof window === 'undefined') return { x: 800, y: 64, w: 320, h: 600 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(300, Math.floor(vw * 0.25));
  const h = vh - TOP_BAR;
  return { x: vw - w, y: TOP_BAR, w, h };
}

export function getDefaultQuickPostBottomRect(): FloatingRect {
  if (typeof window === 'undefined') return { x: 0, y: 300, w: 400, h: 400 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const reserve = getFloatingPanelBottomInsetPx();
  const h = Math.floor(vh * 0.55);
  return { x: 0, y: vh - h - reserve, w: vw, h };
}

/** クイックログパネル（#57）— 既定矩形はクイック投稿と同系。storageKey は `logList.desktop` / `logList.mobile` */
export function getDefaultQuickLogSideRect(): FloatingRect {
  return getDefaultQuickPostSideRect();
}

export function getDefaultQuickLogBottomRect(): FloatingRect {
  return getDefaultQuickPostBottomRect();
}

export function getDefaultQrRect(): FloatingRect {
  if (typeof window === 'undefined') return { x: 900, y: 500, w: 220, h: 260 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = 220;
  const h = 260;
  const margin = 32;
  const reserve = getFloatingPanelBottomInsetPx();
  return { x: vw - w - margin, y: vh - h - margin - reserve, w, h };
}
