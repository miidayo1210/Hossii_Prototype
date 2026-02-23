const SHOW_HOSSII_KEY = 'hossii.showHossii';

/**
 * showHossii を読み込む（デフォルト: true）
 */
export function loadShowHossii(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_HOSSII_KEY);
    if (raw === 'false') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * showHossii を保存
 */
export function saveShowHossii(show: boolean): void {
  try {
    localStorage.setItem(SHOW_HOSSII_KEY, String(show));
  } catch {
    // ignore
  }
}
