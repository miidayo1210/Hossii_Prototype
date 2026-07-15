import { describe, it, expect } from 'vitest';
import { resolveLogScopeSelection } from './resolveLogScopeSelection';

type TestHossii = { id: string; authorId?: string | null };

const h = (id: string, authorId?: string | null): TestHossii => ({ id, authorId });

const base = {
  isAuthenticated: true as boolean,
  guestAuthorId: undefined as string | null | undefined,
  myAuthorshipIds: new Set<string>(),
  myAuthorshipIdsStatus: 'ready' as const,
};

describe('resolveLogScopeSelection - ログイン ready', () => {
  const list = [h('a', 'device-x'), h('b', 'uid-1'), h('c', 'someone')];

  it('mine は Set 一致のみ入る（author_id は使わない）', () => {
    const { scopedHossiis } = resolveLogScopeSelection(list, {
      ...base,
      logScope: 'mine',
      myAuthorshipIds: new Set(['a', 'c']),
    });
    expect(scopedHossiis.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('author_id が一致しても Set 外なら mine に入らない', () => {
    const uid = 'uid-1';
    const { scopedHossiis } = resolveLogScopeSelection(list, {
      ...base,
      logScope: 'mine',
      guestAuthorId: uid, // ログイン中なので使われない想定
      myAuthorshipIds: new Set(['c']),
    });
    expect(scopedHossiis.map((x) => x.id)).toEqual(['c']);
  });

  it('mineCount は ownVisibleHossiis.length と一致する', () => {
    const { mineCount, scopedHossiis } = resolveLogScopeSelection(list, {
      ...base,
      logScope: 'mine',
      myAuthorshipIds: new Set(['a', 'b']),
    });
    expect(mineCount).toBe(2);
    expect(mineCount).toBe(scopedHossiis.length);
    expect(scopedHossiis.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('allCount は常に visibleHossiis 件数', () => {
    const { allCount } = resolveLogScopeSelection(list, {
      ...base,
      logScope: 'mine',
      myAuthorshipIds: new Set(['a']),
    });
    expect(allCount).toBe(3);
  });
});

describe('resolveLogScopeSelection - ログイン未 ready', () => {
  const list = [h('a', 'uid-1'), h('b', 'uid-1')];

  it.each(['idle', 'loading', 'error'] as const)(
    'status=%s では mine は空・mineCount 0（author_id フォールバックなし）',
    (status) => {
      const { scopedHossiis, mineCount } = resolveLogScopeSelection(list, {
        ...base,
        logScope: 'mine',
        guestAuthorId: 'uid-1',
        myAuthorshipIds: new Set(['a', 'b']),
        myAuthorshipIdsStatus: status,
      });
      expect(scopedHossiis).toEqual([]);
      expect(mineCount).toBe(0);
    },
  );

  it.each(['idle', 'loading', 'error'] as const)(
    'status=%s でも all スコープは全 visibleHossiis を返す',
    (status) => {
      const { scopedHossiis, allCount } = resolveLogScopeSelection(list, {
        ...base,
        logScope: 'all',
        myAuthorshipIds: new Set(),
        myAuthorshipIdsStatus: status,
      });
      expect(scopedHossiis).toBe(list);
      expect(allCount).toBe(2);
    },
  );

  it('未 ready でも mineCount(0) は all スコープの表示に影響しない', () => {
    const { mineCount, allCount } = resolveLogScopeSelection(list, {
      ...base,
      logScope: 'all',
      myAuthorshipIdsStatus: 'loading',
    });
    expect(mineCount).toBe(0);
    expect(allCount).toBe(2);
  });
});

describe('resolveLogScopeSelection - ゲスト', () => {
  const list = [h('a', 'device-1'), h('b', 'device-2'), h('c', 'device-1')];

  it('端末 author_id 一致のみ mine に入る（status に依存しない）', () => {
    const { scopedHossiis } = resolveLogScopeSelection(list, {
      logScope: 'mine',
      isAuthenticated: false,
      guestAuthorId: 'device-1',
      myAuthorshipIds: new Set(),
      myAuthorshipIdsStatus: 'idle',
    });
    expect(scopedHossiis.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('guestAuthorId が無ければ mine は空', () => {
    const { scopedHossiis, mineCount } = resolveLogScopeSelection(list, {
      logScope: 'mine',
      isAuthenticated: false,
      guestAuthorId: null,
      myAuthorshipIds: new Set(['a', 'b', 'c']),
      myAuthorshipIdsStatus: 'idle',
    });
    expect(scopedHossiis).toEqual([]);
    expect(mineCount).toBe(0);
  });

  it('authorship Set はゲスト判定に使わない', () => {
    const { scopedHossiis } = resolveLogScopeSelection(list, {
      logScope: 'mine',
      isAuthenticated: false,
      guestAuthorId: 'device-2',
      myAuthorshipIds: new Set(['a', 'c']),
      myAuthorshipIdsStatus: 'ready',
    });
    expect(scopedHossiis.map((x) => x.id)).toEqual(['b']);
  });
});
