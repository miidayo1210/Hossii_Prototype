export type PresentationMode = 'custom' | 'stars';

const STORAGE_KEY = 'hossii.presentationMode';

export function loadPresentationMode(): PresentationMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'stars' || raw === 'custom') return raw;
    // 旧キー `bubbles` はカスタムモードへ移行
    if (raw === 'bubbles') return 'custom';
    return 'stars';
  } catch {
    return 'stars';
  }
}

export function savePresentationMode(mode: PresentationMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
