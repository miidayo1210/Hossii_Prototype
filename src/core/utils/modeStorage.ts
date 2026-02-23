import type { AppMode } from '../types/mode';

const MODE_KEY = 'hossii.mode';

/**
 * モードを読み込む（デフォルト: personal）
 */
export function loadMode(): AppMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'personal' || raw === 'org') {
      return raw;
    }
    return 'personal';
  } catch {
    return 'personal';
  }
}

/**
 * モードを保存
 */
export function saveMode(mode: AppMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }
}
