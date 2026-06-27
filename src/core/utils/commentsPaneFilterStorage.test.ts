import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commentsPaneFilterStorageKey,
  DEFAULT_COMMENTS_PANE_FILTER,
  loadCommentsPaneFilter,
  sanitizeCommentsPaneFilter,
  saveCommentsPaneFilter,
} from './commentsPaneFilterStorage';

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

describe('commentsPaneFilterStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('defaults to current when missing', () => {
    expect(loadCommentsPaneFilter('space-a')).toEqual(DEFAULT_COMMENTS_PANE_FILTER);
  });

  it('save and load round-trip', () => {
    saveCommentsPaneFilter('space-a', { mode: 'all' });
    expect(loadCommentsPaneFilter('space-a')).toEqual({ mode: 'all' });
  });

  it('spaces are independent', () => {
    saveCommentsPaneFilter('space-a', { mode: 'all' });
    saveCommentsPaneFilter('space-b', { mode: 'specific', paneId: 'pane-b' });
    expect(loadCommentsPaneFilter('space-a')).toEqual({ mode: 'all' });
    expect(loadCommentsPaneFilter('space-b', ['pane-b'])).toEqual({
      mode: 'specific',
      paneId: 'pane-b',
    });
  });

  it('invalid JSON returns current', () => {
    localStorage.setItem(commentsPaneFilterStorageKey('space-a'), '{bad');
    expect(loadCommentsPaneFilter('space-a')).toEqual(DEFAULT_COMMENTS_PANE_FILTER);
  });

  it('invalid mode returns current', () => {
    localStorage.setItem(
      commentsPaneFilterStorageKey('space-a'),
      JSON.stringify({ mode: 'unknown' }),
    );
    expect(loadCommentsPaneFilter('space-a')).toEqual(DEFAULT_COMMENTS_PANE_FILTER);
  });

  it('specific with invalid paneId falls back to current', () => {
    saveCommentsPaneFilter('space-a', { mode: 'specific', paneId: 'gone' });
    expect(loadCommentsPaneFilter('space-a', ['pane-1', 'pane-2'])).toEqual(
      DEFAULT_COMMENTS_PANE_FILTER,
    );
  });

  it('sanitize keeps valid specific paneId', () => {
    expect(
      sanitizeCommentsPaneFilter({ mode: 'specific', paneId: 'pane-1' }, ['pane-1']),
    ).toEqual({ mode: 'specific', paneId: 'pane-1' });
  });
});
