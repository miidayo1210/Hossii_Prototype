import { describe, expect, it } from 'vitest';
import { resolveCanEditBubble, type ResolveCanEditBubbleParams } from './canEditBubble';

const base: ResolveCanEditBubbleParams = {
  isAdmin: false,
  bubbleEditPermission: 'owner_and_admin',
  hossiiId: 'p1',
  hossiiAuthorId: undefined,
  isAuthenticated: false,
  guestAuthorId: undefined,
  myAuthorshipIds: new Set<string>(),
  myAuthorshipIdsStatus: 'ready',
};

describe('resolveCanEditBubble - admin / permission', () => {
  it('1. admin → authorship 状態に関係なく true', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAdmin: true,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'error',
        myAuthorshipIds: new Set(),
      }),
    ).toBe(true);
  });

  it('2. bubbleEditPermission=all → true', () => {
    expect(resolveCanEditBubble({ ...base, bubbleEditPermission: 'all' })).toBe(true);
  });

  it('2b. bubbleEditPermission 未設定（null/undefined）→ all 扱いで true', () => {
    expect(resolveCanEditBubble({ ...base, bubbleEditPermission: null })).toBe(true);
    expect(resolveCanEditBubble({ ...base, bubbleEditPermission: undefined })).toBe(true);
  });

  it('3. owner_and_admin 以外の未知値 → false', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        bubbleEditPermission: 'something_else' as unknown as ResolveCanEditBubbleParams['bubbleEditPermission'],
      }),
    ).toBe(false);
  });
});

describe('resolveCanEditBubble - authenticated', () => {
  it('4. status=ready + Set に id あり → true', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'ready',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(true);
  });

  it('5. status=ready + Set に id なし → false', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'ready',
        myAuthorshipIds: new Set(['other']),
      }),
    ).toBe(false);
  });

  it('6. Set に id なし・authorId 一致でも → false（author_id フォールバック禁止）', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'ready',
        hossiiAuthorId: 'uid-1',
        guestAuthorId: 'uid-1',
        myAuthorshipIds: new Set(),
      }),
    ).toBe(false);
  });

  it('7. status=loading → false（Set に id があっても）', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'loading',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(false);
  });

  it('8. status=idle → false', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'idle',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(false);
  });

  it('9. status=error → false（権限を広げない）', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'error',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(false);
  });

  it('10. Identity A: authorId≠auth UID相当でも Set に id あり → true', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: true,
        myAuthorshipIdsStatus: 'ready',
        hossiiAuthorId: 'device-legacy-id', // auth UID とは異なる
        guestAuthorId: 'auth-uid-current',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(true);
  });
});

describe('resolveCanEditBubble - guest', () => {
  it('11. profile.id と authorId 一致 → true', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: false,
        hossiiAuthorId: 'device-1',
        guestAuthorId: 'device-1',
      }),
    ).toBe(true);
  });

  it('12. 不一致 → false', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: false,
        hossiiAuthorId: 'device-1',
        guestAuthorId: 'device-2',
      }),
    ).toBe(false);
  });

  it('13. profile.id なし → false', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: false,
        hossiiAuthorId: 'device-1',
        guestAuthorId: undefined,
      }),
    ).toBe(false);
  });

  it('14. Set に id があってもゲスト判定には影響しない', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: false,
        hossiiAuthorId: 'device-1',
        guestAuthorId: 'device-2',
        myAuthorshipIds: new Set(['p1']),
      }),
    ).toBe(false);
  });

  it('14b. ゲストは authorship status が error でも従来判定できる', () => {
    expect(
      resolveCanEditBubble({
        ...base,
        isAuthenticated: false,
        myAuthorshipIdsStatus: 'error',
        hossiiAuthorId: 'device-1',
        guestAuthorId: 'device-1',
      }),
    ).toBe(true);
  });
});
