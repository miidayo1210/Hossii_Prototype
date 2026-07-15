// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AccountProfileSection } from './AccountProfileSection';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  setDefaultNickname: vi.fn(),
  setSpaceNickname: vi.fn(),
  currentUser: null as {
    uid: string;
    displayName: string | null;
    isAdmin: boolean;
  } | null,
}));

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({ navigate: h.navigate }),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: h.currentUser,
    logout: h.logout,
  }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: {
      profile: { defaultNickname: 'デフォルト名', id: 'p1' },
      spaceNicknames: { 'space-1': 'スペース名' },
      activeSpaceId: 'space-1',
    },
    setDefaultNickname: h.setDefaultNickname,
    setSpaceNickname: h.setSpaceNickname,
    getActiveSpace: () => ({ id: 'space-1', name: 'テストスペース', myHossiiEnabled: false }),
  }),
}));

const identity = {
  displayName: 'テストユーザー',
  status: 'guest' as const,
  statusLabel: 'ゲスト参加中',
  greeting: 'いまはゲストで参加しているよ',
};

describe('AccountProfileSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.currentUser = null;
    h.setDefaultNickname.mockReset();
    h.setSpaceNickname.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('shows guest login actions and nickname fields', () => {
    render(
      <AccountProfileSection
        identity={identity}
        onLoginRequested={vi.fn()}
        onSignUpRequested={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'アカウントでログイン' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '新規会員登録' })).toBeTruthy();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(2);
  });

  it('saves default nickname on button click', () => {
    render(<AccountProfileSection identity={identity} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: '新しい名前' } });
    fireEvent.click(screen.getAllByRole('button', { name: '保存' })[1]);

    expect(h.setDefaultNickname).toHaveBeenCalledWith('新しい名前');
  });

  it('shows logout for logged-in user', () => {
    h.currentUser = { uid: 'u1', displayName: 'User', isAdmin: false };
    render(
      <AccountProfileSection
        identity={{ ...identity, status: 'account', statusLabel: 'アカウントでログイン中' }}
      />,
    );

    expect(screen.getByRole('button', { name: /ログアウト/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'アカウントでログイン' })).toBeNull();
  });
});
