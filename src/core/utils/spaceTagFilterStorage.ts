const storageKey = (spaceId: string) => `hossii.spaceTagFilter.${spaceId}`;

export function loadSpaceTagFilter(spaceId: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(spaceId));
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveSpaceTagFilter(spaceId: string, tag: string | null): void {
  try {
    const key = storageKey(spaceId);
    if (tag == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, tag);
    }
  } catch {
    // ignore
  }
}
