import { scopedStorageKey } from './storageScope';

const STORAGE_KEY = scopedStorageKey('hossii.selectedCommunityId');

export function loadStoredCommunityId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredCommunityId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearStoredCommunityId(): void {
  saveStoredCommunityId(null);
}
