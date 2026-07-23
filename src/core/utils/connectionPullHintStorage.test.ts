import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectionPullHintStorageKey,
  hasSeenConnectionPullHint,
  markConnectionPullHintSeen,
} from './connectionPullHintStorage';

describe('connectionPullHintStorage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubEnv('VITE_EXPECTED_SUPABASE_REF', 'test-scope');
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
    vi.unstubAllEnvs();
  });

  it('returns false when not saved', () => {
    expect(hasSeenConnectionPullHint('space-a')).toBe(false);
  });

  it('returns true after markConnectionPullHintSeen', () => {
    markConnectionPullHintSeen('space-a');
    expect(hasSeenConnectionPullHint('space-a')).toBe(true);
  });

  it('isolates by spaceId', () => {
    markConnectionPullHintSeen('space-a');
    expect(hasSeenConnectionPullHint('space-a')).toBe(true);
    expect(hasSeenConnectionPullHint('space-b')).toBe(false);
  });

  it('handles empty spaceId safely', () => {
    expect(hasSeenConnectionPullHint('')).toBe(false);
    expect(hasSeenConnectionPullHint('   ')).toBe(false);
    expect(() => markConnectionPullHintSeen('')).not.toThrow();
    expect(store.size).toBe(0);
  });

  it('scopes storage keys by environment prefix', () => {
    expect(connectionPullHintStorageKey('space-a')).toBe(
      'test-scope:hossii.connectionPullHintSeen.space-a',
    );
    markConnectionPullHintSeen('space-a');
    expect(store.has('test-scope:hossii.connectionPullHintSeen.space-a')).toBe(true);
  });
});
