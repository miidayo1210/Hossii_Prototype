import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredCommunityId,
  loadStoredCommunityId,
  saveStoredCommunityId,
} from './selectedCommunityStorage';

describe('selectedCommunityStorage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredCommunityId();
  });

  it('saves and loads community id', () => {
    saveStoredCommunityId('community-1');
    expect(loadStoredCommunityId()).toBe('community-1');
  });

  it('clearStoredCommunityId removes persisted value', () => {
    saveStoredCommunityId('community-1');
    clearStoredCommunityId();
    expect(loadStoredCommunityId()).toBeNull();
  });
});
