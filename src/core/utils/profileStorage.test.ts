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

/**
 * ログイン hydrate の SET_SPACE_NICKNAMES: サーバー取得結果で置き換える。
 * 前アカウントの端末キャッシュと merge しない。
 */
function replaceAuthSyncNicknames(
  save: (map: SpaceNicknames) => void,
  serverPayload: SpaceNicknames,
): SpaceNicknames {
  save(serverPayload);
  return serverPayload;
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

  it('replaces previous account nicknames when server returns empty', () => {
    storage.saveSpaceNicknames({ 'guest-space': 'GuestNick', 'other-space': 'Other' });
    replaceAuthSyncNicknames(storage.saveSpaceNicknames, {});
    expect(storage.loadSpaceNicknames()).toEqual({});
  });

  it('uses only the logged-in account server nicknames', () => {
    storage.saveSpaceNicknames({ 'prev-account-space': 'PrevNick', 'other-space': 'Other' });
    replaceAuthSyncNicknames(storage.saveSpaceNicknames, {
      'auth-space': 'ServerNick',
    });
    expect(storage.loadSpaceNicknames()).toEqual({
      'auth-space': 'ServerNick',
    });
  });

  it('lets server nickname for the same account override local cache', () => {
    storage.saveSpaceNicknames({ 'space-a': 'StaleLocal' });
    replaceAuthSyncNicknames(storage.saveSpaceNicknames, {
      'space-a': 'ServerNick',
    });
    expect(storage.loadSpaceNicknames()).toEqual({ 'space-a': 'ServerNick' });
  });

  it('same account re-login restores server nicknames only', () => {
    storage.saveSpaceNicknames({});
    replaceAuthSyncNicknames(storage.saveSpaceNicknames, { 'space-a': 'mii' });
    expect(storage.loadSpaceNicknames()).toEqual({ 'space-a': 'mii' });

    // 別アカウントへ切替（サーバー空）→ 持ち越さない
    replaceAuthSyncNicknames(storage.saveSpaceNicknames, {});
    expect(storage.loadSpaceNicknames()).toEqual({});

    // 同じアカウント再ログイン → サーバーから復元
    replaceAuthSyncNicknames(storage.saveSpaceNicknames, { 'space-a': 'mii' });
    expect(storage.loadSpaceNicknames()).toEqual({ 'space-a': 'mii' });
  });
});
