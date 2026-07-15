import { describe, expect, it } from 'vitest';
import { isOwnHossii } from './isOwnHossii';

const base = {
  hossiiId: 'p1',
  hossiiAuthorId: undefined as string | null | undefined,
  isAuthenticated: false,
  guestAuthorId: undefined as string | null | undefined,
  myAuthorshipIds: new Set<string>(),
};

describe('isOwnHossii - authenticated', () => {
  it('1. authorship Set に hossiiId がある → true', () => {
    expect(
      isOwnHossii({ ...base, isAuthenticated: true, myAuthorshipIds: new Set(['p1']) }),
    ).toBe(true);
  });

  it('2. Set にない → false', () => {
    expect(
      isOwnHossii({ ...base, isAuthenticated: true, myAuthorshipIds: new Set(['other']) }),
    ).toBe(false);
  });

  it('3. Set にないが authorId が一致しても → false（author_id フォールバック禁止）', () => {
    expect(
      isOwnHossii({
        ...base,
        isAuthenticated: true,
        hossiiAuthorId: 'uid-1',
        guestAuthorId: 'uid-1',
        myAuthorshipIds: new Set(),
      }),
    ).toBe(false);
  });

  it('4. guestAuthorId が一致しても Set になければ → false', () => {
    expect(
      isOwnHossii({
        ...base,
        isAuthenticated: true,
        hossiiAuthorId: 'device-1',
        guestAuthorId: 'device-1',
        myAuthorshipIds: new Set(['p2']),
      }),
    ).toBe(false);
  });

  it('5. 空 Set → false', () => {
    expect(isOwnHossii({ ...base, isAuthenticated: true, myAuthorshipIds: new Set() })).toBe(false);
  });

  it('6. 空 hossiiId → false', () => {
    expect(
      isOwnHossii({ ...base, hossiiId: '', isAuthenticated: true, myAuthorshipIds: new Set(['']) }),
    ).toBe(false);
  });
});

describe('isOwnHossii - guest', () => {
  it('7. guestAuthorId と hossiiAuthorId が一致 → true', () => {
    expect(
      isOwnHossii({ ...base, hossiiAuthorId: 'device-1', guestAuthorId: 'device-1' }),
    ).toBe(true);
  });

  it('8. 不一致 → false', () => {
    expect(
      isOwnHossii({ ...base, hossiiAuthorId: 'device-1', guestAuthorId: 'device-2' }),
    ).toBe(false);
  });

  it('9. guestAuthorId なし → false', () => {
    expect(isOwnHossii({ ...base, hossiiAuthorId: 'device-1', guestAuthorId: undefined })).toBe(false);
  });

  it('10. hossiiAuthorId なし → false', () => {
    expect(isOwnHossii({ ...base, hossiiAuthorId: undefined, guestAuthorId: 'device-1' })).toBe(false);
  });

  it('11. authorship Set に入っていてもゲスト判定では影響しない', () => {
    expect(
      isOwnHossii({
        ...base,
        isAuthenticated: false,
        hossiiAuthorId: 'device-1',
        guestAuthorId: 'device-2',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(false);
  });
});

describe('isOwnHossii - Identity A の重要ケース', () => {
  it('author_id ≠ auth UID相当 だが authorship Set に hossiiId あり → ログイン中は true', () => {
    expect(
      isOwnHossii({
        ...base,
        isAuthenticated: true,
        hossiiAuthorId: 'device-legacy-id', // auth UID とは異なる
        guestAuthorId: 'auth-uid-current',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(true);
  });

  it('author_id が端末IDと一致 だが authorship Set に hossiiId なし → ログイン中は false', () => {
    expect(
      isOwnHossii({
        ...base,
        isAuthenticated: true,
        hossiiAuthorId: 'device-id',
        guestAuthorId: 'device-id',
        myAuthorshipIds: new Set(),
      }),
    ).toBe(false);
  });
});

describe('isOwnHossii - 認証未確定は安全側 false', () => {
  it('isAuthenticated=false かつ guest 情報なし → false', () => {
    expect(isOwnHossii({ ...base })).toBe(false);
  });
});
