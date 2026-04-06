/**
 * Display Preferences Storage
 * Manages display period filter, display limit, view mode, and bubble layout mode settings.
 */

import {
  DEFAULT_BUBBLE_PALETTE_ID,
  getBubblePalette,
  type BubblePaletteId,
} from './bubbleColorPalettes';

// ---- DisplayPeriod ----

export type DisplayPeriod = '1d' | '1w' | '1m' | 'all';

const DISPLAY_PERIOD_KEY = 'hossii.displayPeriod';
const DEFAULT_PERIOD: DisplayPeriod = '1w';

const VALID_PERIODS: DisplayPeriod[] = ['1d', '1w', '1m', 'all'];

export function loadDisplayPeriod(): DisplayPeriod {
  try {
    const raw = localStorage.getItem(DISPLAY_PERIOD_KEY);
    if (raw && (VALID_PERIODS as string[]).includes(raw)) return raw as DisplayPeriod;
    return DEFAULT_PERIOD;
  } catch {
    return DEFAULT_PERIOD;
  }
}

export function saveDisplayPeriod(period: DisplayPeriod): void {
  try {
    localStorage.setItem(DISPLAY_PERIOD_KEY, period);
  } catch {
    // ignore
  }
}

/** Returns a Date cutoff for the given period, or null for 'all'. */
export function getPeriodCutoff(period: DisplayPeriod): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === '1d') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === '1w') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === '1m') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

// ---- DisplayLimit ----

export type DisplayLimit = 50 | 100 | 150 | 'unlimited';

const DISPLAY_LIMIT_KEY = 'hossii.displayLimit';
const DEFAULT_LIMIT: DisplayLimit = 50;

const VALID_LIMITS: Array<DisplayLimit> = [50, 100, 150, 'unlimited'];

export function loadDisplayLimit(): DisplayLimit {
  try {
    const raw = localStorage.getItem(DISPLAY_LIMIT_KEY);
    if (!raw) return DEFAULT_LIMIT;
    if (raw === 'unlimited') return 'unlimited';
    const n = parseInt(raw, 10);
    if (n === 50 || n === 100 || n === 150) return n;
    return DEFAULT_LIMIT;
  } catch {
    return DEFAULT_LIMIT;
  }
}

export function saveDisplayLimit(limit: DisplayLimit): void {
  try {
    localStorage.setItem(DISPLAY_LIMIT_KEY, String(limit));
  } catch {
    // ignore
  }
}

// ---- ViewMode ----

export type ViewMode = 'full' | 'bubble' | 'image' | 'slideshow';

const VIEW_MODE_KEY = 'hossii.viewMode';
const DEFAULT_VIEW_MODE: ViewMode = 'full';

const VALID_VIEW_MODES: ViewMode[] = ['full', 'bubble', 'image', 'slideshow'];

export function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw && (VALID_VIEW_MODES as string[]).includes(raw)) return raw as ViewMode;
    return DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

// ---- LayoutMode ----

export type LayoutMode = 'random' | 'ordered';

const LAYOUT_MODE_KEY = 'hossii.layoutMode';
const DEFAULT_LAYOUT_MODE: LayoutMode = 'random';

const VALID_LAYOUT_MODES: LayoutMode[] = ['random', 'ordered'];

export function loadLayoutMode(): LayoutMode {
  try {
    const raw = localStorage.getItem(LAYOUT_MODE_KEY);
    if (raw && (VALID_LAYOUT_MODES as string[]).includes(raw)) return raw as LayoutMode;
    return DEFAULT_LAYOUT_MODE;
  } catch {
    return DEFAULT_LAYOUT_MODE;
  }
}

export function saveLayoutMode(mode: LayoutMode): void {
  try {
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

// ---- OrderedSortDirection（投稿順格子のセル詰め順。表示の形は同じ） ----

/** `desc`: 左上が新しい投稿（既定）。`asc`: 左上が古い投稿 */
export type OrderedSortDirection = 'asc' | 'desc';

const ORDERED_SORT_KEY = 'hossii.orderedSortDirection';
const DEFAULT_ORDERED_SORT: OrderedSortDirection = 'desc';

const VALID_ORDERED_SORT: OrderedSortDirection[] = ['asc', 'desc'];

export function loadOrderedSortDirection(): OrderedSortDirection {
  try {
    const raw = localStorage.getItem(ORDERED_SORT_KEY);
    if (raw && (VALID_ORDERED_SORT as string[]).includes(raw)) return raw as OrderedSortDirection;
    return DEFAULT_ORDERED_SORT;
  } catch {
    return DEFAULT_ORDERED_SORT;
  }
}

export function saveOrderedSortDirection(direction: OrderedSortDirection): void {
  try {
    localStorage.setItem(ORDERED_SORT_KEY, direction);
  } catch {
    // ignore
  }
}

// ---- スペース右上の投稿数バッジ表示 ----

const SHOW_POST_COUNT_BADGE_KEY = 'hossii.showPostCountBadge';

export function loadShowPostCountBadge(): boolean {
  try {
    return localStorage.getItem(SHOW_POST_COUNT_BADGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveShowPostCountBadge(value: boolean): void {
  try {
    localStorage.setItem(SHOW_POST_COUNT_BADGE_KEY, String(value));
  } catch {
    // ignore
  }
}

// suppress unused variable warning on VALID_LIMITS (used for type safety)
void VALID_LIMITS;

// ---- ContinuousPost ----

const CONTINUOUS_POST_KEY = 'hossii.continuousPost';

export function loadContinuousPost(): boolean {
  try {
    return localStorage.getItem(CONTINUOUS_POST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveContinuousPost(value: boolean): void {
  try {
    localStorage.setItem(CONTINUOUS_POST_KEY, String(value));
  } catch {
    // ignore
  }
}

// ---- Last post bubble color（テーマ + スウォッチ、端末ローカルのみ） ----

const LAST_BUBBLE_COLOR_PREFS_KEY = 'hossii.lastPostBubbleColorPrefs';

const VALID_BUBBLE_PALETTE_IDS: BubblePaletteId[] = ['mono', 'lavender', 'vivid', 'pastel'];

export type PostBubbleColorDraft = {
  paletteId: BubblePaletteId;
  /** null = デフォルト（未指定） */
  color: string | null;
};

/** 投稿画面の吹き出し色の初期値（無効な保存値はフォールバック） */
export function loadPostBubbleColorDraft(): PostBubbleColorDraft {
  try {
    const raw = localStorage.getItem(LAST_BUBBLE_COLOR_PREFS_KEY);
    if (!raw) {
      return { paletteId: DEFAULT_BUBBLE_PALETTE_ID, color: null };
    }
    const parsed = JSON.parse(raw) as { paletteId?: unknown; color?: unknown };
    const paletteId =
      typeof parsed.paletteId === 'string' && VALID_BUBBLE_PALETTE_IDS.includes(parsed.paletteId as BubblePaletteId)
        ? (parsed.paletteId as BubblePaletteId)
        : DEFAULT_BUBBLE_PALETTE_ID;
    const colors = getBubblePalette(paletteId).colors;
    let color: string | null = null;
    if (parsed.color === null || parsed.color === undefined) {
      color = null;
    } else if (typeof parsed.color === 'string' && colors.includes(parsed.color)) {
      color = parsed.color;
    }
    return { paletteId, color };
  } catch {
    return { paletteId: DEFAULT_BUBBLE_PALETTE_ID, color: null };
  }
}

export function savePostBubbleColorDraft(paletteId: BubblePaletteId, color: string | null): void {
  try {
    localStorage.setItem(LAST_BUBBLE_COLOR_PREFS_KEY, JSON.stringify({ paletteId, color }));
  } catch {
    // ignore
  }
}
