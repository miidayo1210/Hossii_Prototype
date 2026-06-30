const STORAGE_PREFIX = 'hossii.spaceWelcomeBanner.dismissed.';

export function loadWelcomeBannerDismissed(spaceId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`) === '1';
  } catch {
    return false;
  }
}

export function saveWelcomeBannerDismissed(spaceId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, '1');
  } catch {
    /* quota / private mode */
  }
}
