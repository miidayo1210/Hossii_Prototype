/**
 * Display Scale Settings Storage
 * Manages the app-wide display scale for better readability on projectors/high-resolution displays
 */

export type DisplayScale = 1 | 1.25 | 1.5;

const DISPLAY_SCALE_KEY = 'hossii.displayScale';
const DEFAULT_SCALE: DisplayScale = 1;

/**
 * Load display scale from localStorage
 * @returns DisplayScale (default: 1)
 */
export function loadDisplayScale(): DisplayScale {
  try {
    const raw = localStorage.getItem(DISPLAY_SCALE_KEY);
    if (!raw) return DEFAULT_SCALE;

    const parsed = parseFloat(raw);
    if (parsed === 1 || parsed === 1.25 || parsed === 1.5) {
      return parsed as DisplayScale;
    }
    return DEFAULT_SCALE;
  } catch {
    return DEFAULT_SCALE;
  }
}

/**
 * Save display scale to localStorage
 * @param scale - The scale to save
 */
export function saveDisplayScale(scale: DisplayScale): void {
  try {
    localStorage.setItem(DISPLAY_SCALE_KEY, scale.toString());
  } catch {
    // ignore storage errors
  }
}
