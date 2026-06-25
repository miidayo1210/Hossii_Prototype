import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadPinnedIds,
  pinnedStorageKey,
  savePinnedIds,
} from './pinnedHossiisStorage';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('pinnedHossiisStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('load returns empty when missing', () => {
    expect(loadPinnedIds('space-a')).toEqual([]);
  });

  it('save and load round-trip', () => {
    savePinnedIds('space-a', ['h1', 'h2']);
    expect(loadPinnedIds('space-a')).toEqual(['h1', 'h2']);
  });

  it('invalid JSON returns empty', () => {
    localStorage.setItem(pinnedStorageKey('space-a'), '{not json');
    expect(loadPinnedIds('space-a')).toEqual([]);
  });

  it('spaces are independent', () => {
    savePinnedIds('space-a', ['a1']);
    savePinnedIds('space-b', ['b1', 'b2']);
    expect(loadPinnedIds('space-a')).toEqual(['a1']);
    expect(loadPinnedIds('space-b')).toEqual(['b1', 'b2']);
  });
});
