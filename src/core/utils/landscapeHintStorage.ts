const DISMISSED_KEY = 'hossii.landscapeHint.dismissed';

export function loadLandscapeHintDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveLandscapeHintDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* quota / private mode */
  }
}
