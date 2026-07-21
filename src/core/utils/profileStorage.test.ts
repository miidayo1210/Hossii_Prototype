import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceNicknames } from '../types/profile';
import { scopedStorageKey } from './storageScope';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

/** SET_SPACE_NICKNAMES reducer と同じ merge */
function mergeSpaceNicknames(local: SpaceNicknames, server: SpaceNicknames): SpaceNicknames {
  return { ...local, ...server };
}

/**
 * 修正後 syncLoggedInProfile: dispatch(SET_SPACE_NICKNAMES) の reducer 保存のみ。
 */
function persistAuthSyncNicknames(
  load: () => SpaceNicknames,
  save: (map: SpaceNicknames) => void,
  serverPayload: SpaceNicknames,
): SpaceNicknames {
  const merged = mergeSpaceNicknames(load(), serverPayload);
  save(merged);
  return merged;
}

/**
 * 修正前の欠陥: reducer 保存後に server payload だけを再保存。
 * HossiiStoreProvider の saveSpaceNicknames(nicknames) 再導入と同型。
 */
function persistAuthSyncNicknamesWithDuplicateServerSave(
  load: () => SpaceNicknames,
  save: (map: SpaceNicknames) => void,
  serverPayload: SpaceNicknames,
): void {
  persistAuthSyncNicknames(load, save, serverPayload);
  save(serverPayload);
}

describe('profileStorage auth sync nickname persistence', () => {
  let memory: ReturnType<typeof createMemoryStorage>;
  let storage: typeof import('./profileStorage');
  let nicknamesKey: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('VITE_EXPECTED_SUPABASE_REF', 'uodaubhlcvvqlgsdxcdf');
    memory = createMemoryStorage();
    vi.stubGlobal('localStorage', memory);
    storage = await import('./profileStorage');
    nicknamesKey = scopedStorageKey('hossii.spaceNicknames');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('scopes nicknames by environment prefix', () => {
    storage.setSpaceNickname('space-a', 'Guest');
    expect([...memory.store.keys()]).toContain('uodaubhlcvvqlgsdxcdf:hossii.spaceNicknames');
    expect(nicknamesKey).toBe('uodaubhlcvvqlgsdxcdf:hossii.spaceNicknames');
  });

  it('persists nickname across reload-style re-read', () => {
    storage.setSpaceNickname('space-a', 'GuestA');
    expect(storage.loadSpaceNicknames()).toEqual({ 'space-a': 'GuestA' });
    expect(storage.loadSpaceNicknames()).toEqual({ 'space-a': 'GuestA' });
  });

  it('falls back safely on invalid JSON', () => {
    memory.setItem(nicknamesKey, '{not-json');
    expect(storage.loadSpaceNicknames()).toEqual({});
  });

  it('preserves local-only nicknames when server returns empty object', () => {
    storage.saveSpaceNicknames({ 'guest-space': 'GuestNick', 'other-space': 'Other' });
    persistAuthSyncNicknames(storage.loadSpaceNicknames, storage.saveSpaceNicknames, {});
    expect(storage.loadSpaceNicknames()).toEqual({
      'guest-space': 'GuestNick',
      'other-space': 'Other',
    });
  });

  it('merges server nicknames without dropping other local spaces', () => {
    storage.saveSpaceNicknames({ 'guest-space': 'GuestNick', 'other-space': 'Other' });
    persistAuthSyncNicknames(storage.loadSpaceNicknames, storage.saveSpaceNicknames, {
      'auth-space': 'ServerNick',
    });
    expect(storage.loadSpaceNicknames()).toEqual({
      'guest-space': 'GuestNick',
      'other-space': 'Other',
      'auth-space': 'ServerNick',
    });
  });

  it('lets server nickname override the same space id on merge', () => {
    storage.saveSpaceNicknames({ 'space-a': 'GuestNick' });
    persistAuthSyncNicknames(storage.loadSpaceNicknames, storage.saveSpaceNicknames, {
      'space-a': 'ServerNick',
    });
    expect(storage.loadSpaceNicknames()).toEqual({ 'space-a': 'ServerNick' });
  });

  it('regression: duplicate server-only save after merge wipes local-only nicknames', () => {
    storage.saveSpaceNicknames({ 'guest-space': 'GuestNick' });
    persistAuthSyncNicknamesWithDuplicateServerSave(
      storage.loadSpaceNicknames,
      storage.saveSpaceNicknames,
      {},
    );
    expect(storage.loadSpaceNicknames()).toEqual({});
  });
});
