import { describe, expect, it } from 'vitest';
import { resolveAccountIdentity } from './resolveAccountIdentity';

describe('resolveAccountIdentity', () => {
  it('prefers space nickname over other names', () => {
    const identity = resolveAccountIdentity({
      currentUser: { uid: 'u1', email: 'a@b.c', displayName: null, isAdmin: false },
      spaceNickname: 'スペース名',
      communityNickname: 'コミュニティ名',
      profileNickname: 'プロフィール名',
    });
    expect(identity.displayName).toBe('スペース名');
    expect(identity.statusLabel).toBe('アカウントでログイン中');
    expect(identity.greeting).toContain('スペース名');
  });

  it('shows guest identity without email', () => {
    const identity = resolveAccountIdentity({
      currentUser: null,
      profileNickname: 'ignored',
    });
    expect(identity.displayName).toBe('ゲスト');
    expect(identity.status).toBe('guest');
    expect(identity.statusLabel).toBe('ゲスト参加中');
    expect(identity.greeting).toMatch(/ゲスト|ログイン/);
  });

  it('labels issued participant login', () => {
    const identity = resolveAccountIdentity({
      currentUser: {
        uid: 'p1',
        email: null,
        displayName: null,
        isAdmin: false,
        isIssuedParticipant: true,
        username: '参加01',
      },
      profileNickname: '参加01',
    });
    expect(identity.status).toBe('participant');
    expect(identity.statusLabel).toBe('参加IDでログイン中');
  });
});
