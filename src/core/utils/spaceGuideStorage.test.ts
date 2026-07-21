import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasSeenSpaceGuide,
  markSpaceGuideSeen,
  spaceGuideStorageKey,
} from './spaceGuideStorage';

describe('spaceGuideStorage', () => {
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
    expect(hasSeenSpaceGuide('space-a')).toBe(false);
  });

  it('returns true after markSpaceGuideSeen', () => {
    markSpaceGuideSeen('space-a');
    expect(hasSeenSpaceGuide('space-a')).toBe(true);
  });

  it('isolates by spaceId', () => {
    markSpaceGuideSeen('space-a');
    expect(hasSeenSpaceGuide('space-a')).toBe(true);
    expect(hasSeenSpaceGuide('space-b')).toBe(false);
  });

  it('handles empty spaceId safely', () => {
    expect(hasSeenSpaceGuide('')).toBe(false);
    expect(hasSeenSpaceGuide('   ')).toBe(false);
    expect(() => markSpaceGuideSeen('')).not.toThrow();
    expect(store.size).toBe(0);
  });

  it('treats corrupted values as not seen', () => {
    const key = spaceGuideStorageKey('space-a');
    expect(key).toBeTruthy();
    store.set(key!, '{not-json');
    expect(hasSeenSpaceGuide('space-a')).toBe(false);
    store.set(key!, '{"other":true}');
    expect(hasSeenSpaceGuide('space-a')).toBe(false);
  });

  it('accepts JSON seenAt payload', () => {
    const key = spaceGuideStorageKey('space-a');
    store.set(key!, JSON.stringify({ seenAt: '2026-01-01T00:00:00.000Z' }));
    expect(hasSeenSpaceGuide('space-a')).toBe(true);
  });

  it('does not throw when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(hasSeenSpaceGuide('space-a')).toBe(false);
    expect(() => markSpaceGuideSeen('space-a')).not.toThrow();
  });

  it('scopes storage keys by environment prefix', () => {
    expect(spaceGuideStorageKey('space-a')).toBe('test-scope:hossii.spaceGuideSeen.space-a');
    markSpaceGuideSeen('space-a');
    expect(store.has('test-scope:hossii.spaceGuideSeen.space-a')).toBe(true);
  });
});
