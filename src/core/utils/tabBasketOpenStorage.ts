const STORAGE_PREFIX = 'hossii.tabBasketOpen:';

export function loadTabBasketOpen(spaceId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`) === '1';
  } catch {
    return false;
  }
}

export function saveTabBasketOpen(spaceId: string, open: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, open ? '1' : '0');
  } catch {
    // ignore
  }
}
