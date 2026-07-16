// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AccountHomeSection } from './AccountHomeSection';

vi.mock('./useAccountHomeEntryBadges', () => ({
  useAccountHomeEntryBadges: () => ({
    spaces: null,
    myHossii: null,
    loading: false,
  }),
  badgeForSection: () => null,
}));

const identity = {
  displayName: 'テストユーザー',
  status: 'account' as const,
  statusLabel: 'アカウントでログイン中',
  greeting: 'テストユーザーさん、おかえり！',
};

describe('AccountHomeSection', () => {
  afterEach(cleanup);

  it('shows summary rows and entry cards without forms or lists', () => {
    render(
      <AccountHomeSection
        identity={identity}
        communitySummary="Dev Community"
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('テストユーザーさん、おかえり！')).toBeTruthy();
    expect(screen.getByText('テストユーザー')).toBeTruthy();
    expect(screen.getByText('アカウントでログイン中')).toBeTruthy();
    expect(screen.getByText('Dev Community')).toBeTruthy();
    expect(screen.getByRole('button', { name: /プロフィール/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /参加先/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /マイHossii/ })).toBeTruthy();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
  });

  it('navigates to section when entry card is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <AccountHomeSection
        identity={identity}
        communitySummary="Dev Community"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /プロフィール/ }));
    expect(onNavigate).toHaveBeenCalledWith('account', 'profile');
  });
});
