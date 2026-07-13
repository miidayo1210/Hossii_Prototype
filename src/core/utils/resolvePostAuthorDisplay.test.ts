import { describe, it, expect } from 'vitest';
import { resolvePostAuthorDisplay } from './resolvePostAuthorDisplay';

describe('resolvePostAuthorDisplay', () => {
  it('#1 現在名＝投稿時名 → 主表示のみ（補足なし）', () => {
    const r = resolvePostAuthorDisplay({ postedName: 'ほっしー太郎', currentName: 'ほっしー太郎', isOwnPost: false });
    expect(r.primaryName).toBe('ほっしー太郎');
    expect(r.postedNameLabel).toBeNull();
  });

  it('#2 現在名≠投稿時名 → 現在名を主表示、投稿時名を補足', () => {
    const r = resolvePostAuthorDisplay({ postedName: '旧なまえ', currentName: '新しい名前', isOwnPost: false });
    expect(r.primaryName).toBe('新しい名前');
    expect(r.postedNameLabel).toBe('旧なまえ');
  });

  it('#3 現在名が null/空 → 投稿時名のみ', () => {
    expect(resolvePostAuthorDisplay({ postedName: '投稿時名', currentName: null, isOwnPost: false }))
      .toEqual({ primaryName: '投稿時名', postedNameLabel: null, isCurrentUser: false });
    expect(resolvePostAuthorDisplay({ postedName: '投稿時名', currentName: '   ', isOwnPost: false }).primaryName)
      .toBe('投稿時名');
    expect(resolvePostAuthorDisplay({ postedName: '投稿時名', currentName: undefined, isOwnPost: false }).postedNameLabel)
      .toBeNull();
  });

  it('#4 ゲスト投稿相当（現在名なし）→ 投稿時名のみ', () => {
    const r = resolvePostAuthorDisplay({ postedName: 'ゲストさん', currentName: undefined, isOwnPost: false });
    expect(r.primaryName).toBe('ゲストさん');
    expect(r.postedNameLabel).toBeNull();
  });

  it('前後空白は trim して比較（空白だけの差は同一扱い）', () => {
    const r = resolvePostAuthorDisplay({ postedName: '  なまえ  ', currentName: 'なまえ', isOwnPost: false });
    expect(r.primaryName).toBe('なまえ');
    expect(r.postedNameLabel).toBeNull();
  });

  it('投稿時名が空・現在名あり → 現在名のみ（補足なし）', () => {
    const r = resolvePostAuthorDisplay({ postedName: '', currentName: '現在名', isOwnPost: false });
    expect(r.primaryName).toBe('現在名');
    expect(r.postedNameLabel).toBeNull();
  });

  it('両方空 → 空文字（呼び出し側で非表示）', () => {
    const r = resolvePostAuthorDisplay({ postedName: null, currentName: null, isOwnPost: false });
    expect(r.primaryName).toBe('');
    expect(r.postedNameLabel).toBeNull();
  });

  it('isOwnPost が isCurrentUser に反映される', () => {
    expect(resolvePostAuthorDisplay({ postedName: 'a', currentName: 'b', isOwnPost: true }).isCurrentUser).toBe(true);
    expect(resolvePostAuthorDisplay({ postedName: 'a', currentName: 'b', isOwnPost: false }).isCurrentUser).toBe(false);
  });
});
