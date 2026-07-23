import { scopedStorageKey } from './storageScope';

function storageKeyForSpace(spaceId: string): string | null {
  const trimmed = spaceId.trim();
  if (!trimmed) return null;
  return scopedStorageKey(`hossii.connectionPullHintSeen.${trimmed}`);
}

function parseSeenValue(raw: string): boolean {
  if (raw === '1') return true;
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { seenAt?: unknown }).seenAt === 'string'
    );
  } catch {
    return false;
  }
}

export function hasSeenConnectionPullHint(spaceId: string): boolean {
  const key = storageKeyForSpace(spaceId);
  if (!key) return false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    return parseSeenValue(raw);
  } catch {
    return false;
  }
}

export function markConnectionPullHintSeen(spaceId: string): void {
  const key = storageKeyForSpace(spaceId);
  if (!key) return;
  try {
    localStorage.setItem(key, '1');
  } catch {
    // ignore — UI should still close
  }
}

/** @internal test helper */
export function connectionPullHintStorageKey(spaceId: string): string | null {
  return storageKeyForSpace(spaceId);
}
