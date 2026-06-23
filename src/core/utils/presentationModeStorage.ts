export type PresentationMode = 'bubbles' | 'stars';

const STORAGE_KEY = 'hossii.presentationMode';

export function loadPresentationMode(): PresentationMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'bubbles' || raw === 'stars') return raw;
    return 'bubbles';
  } catch {
    return 'bubbles';
  }
}

export function savePresentationMode(mode: PresentationMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
