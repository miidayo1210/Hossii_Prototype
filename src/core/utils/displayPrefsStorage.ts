/**
 * Display Preferences Storage
 * Manages display period filter, display limit, and view mode settings.
 */

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

export type ViewMode = 'full' | 'bubble' | 'image';

const VIEW_MODE_KEY = 'hossii.viewMode';
const DEFAULT_VIEW_MODE: ViewMode = 'full';

const VALID_VIEW_MODES: ViewMode[] = ['full', 'bubble', 'image'];

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

// suppress unused variable warning on VALID_LIMITS (used for type safety)
void VALID_LIMITS;
