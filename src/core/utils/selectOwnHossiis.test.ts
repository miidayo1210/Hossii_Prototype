import { describe, it, expect } from 'vitest';
import { selectOwnHossiis } from './selectOwnHossiis';

type TestHossii = { id: string; authorId?: string | null; note?: string };

const h = (id: string, authorId?: string | null, note?: string): TestHossii => ({
  id,
  authorId,
  note,
});

describe('selectOwnHossiis - ログイン中', () => {
  it('Set に ID がある投稿だけ返す', () => {
    const list = [h('a', 'x'), h('b', 'y'), h('c', 'z')];
    const result = selectOwnHossiis(list, {
      isAuthenticated: true,
      guestAuthorId: null,
      myAuthorshipIds: new Set(['a', 'c']),
    });
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('author_id が UID と一致しても Set に無ければ返さない', () => {
    const uid = 'uid-123';
    const list = [h('a', uid), h('b', uid)];
    const result = selectOwnHossiis(list, {
      isAuthenticated: true,
      guestAuthorId: uid,
      myAuthorshipIds: new Set(['b']),
    });
    expect(result.map((r) => r.id)).toEqual(['b']);
  });

  it('Set にあれば author_id が異なっても返す', () => {
    const list = [h('a', 'someone-else'), h('b', null)];
    const result = selectOwnHossiis(list, {
      isAuthenticated: true,
      guestAuthorId: null,
      myAuthorshipIds: new Set(['a', 'b']),
    });
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('空 Set なら 0 件', () => {
    const list = [h('a', 'x'), h('b', 'y')];
    const result = selectOwnHossiis(list, {
      isAuthenticated: true,
      guestAuthorId: 'x',
      myAuthorshipIds: new Set(),
    });
    expect(result).toEqual([]);
  });

  it('複数投稿の順序を維持する', () => {
    const list = [h('c', 'x'), h('a', 'y'), h('b', 'z'), h('d', 'w')];
    const result = selectOwnHossiis(list, {
      isAuthenticated: true,
      guestAuthorId: null,
      myAuthorshipIds: new Set(['a', 'b', 'c', 'd']),
    });
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('入力を破壊しない', () => {
    const list = [h('a', 'x'), h('b', 'y')];
    const snapshot = JSON.parse(JSON.stringify(list));
    const result = selectOwnHossiis(list, {
      isAuthenticated: true,
      guestAuthorId: null,
      myAuthorshipIds: new Set(['a']),
    });
    expect(list).toEqual(snapshot);
    expect(result).not.toBe(list);
  });
});

describe('selectOwnHossiis - ゲスト', () => {
  it('guestAuthorId 一致だけ返す', () => {
    const list = [h('a', 'device-1'), h('b', 'device-2'), h('c', 'device-1')];
    const result = selectOwnHossiis(list, {
      isAuthenticated: false,
      guestAuthorId: 'device-1',
      myAuthorshipIds: new Set(),
    });
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('guestAuthorId なしなら 0 件', () => {
    const list = [h('a', 'device-1'), h('b', 'device-2')];
    const result = selectOwnHossiis(list, {
      isAuthenticated: false,
      guestAuthorId: null,
      myAuthorshipIds: new Set(['a', 'b']),
    });
    expect(result).toEqual([]);
  });

  it('authorship Set があってもゲスト判定には使用しない', () => {
    const list = [h('a', 'device-1'), h('b', 'device-9')];
    const result = selectOwnHossiis(list, {
      isAuthenticated: false,
      guestAuthorId: 'device-1',
      myAuthorshipIds: new Set(['a', 'b']),
    });
    expect(result.map((r) => r.id)).toEqual(['a']);
  });
});
