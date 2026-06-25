const KEY_PREFIX = 'hossii_pins_';

export function pinnedStorageKey(spaceId: string): string {
  return `${KEY_PREFIX}${spaceId}`;
}

export function loadPinnedIds(spaceId: string): string[] {
  try {
    const raw = localStorage.getItem(pinnedStorageKey(spaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function savePinnedIds(spaceId: string, ids: string[]): void {
  localStorage.setItem(pinnedStorageKey(spaceId), JSON.stringify(ids));
}
