// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AccountScreen } from './AccountScreen';

const h = vi.hoisted(() => ({
  screenParam: undefined as string | undefined,
  navigate: vi.fn(),
  currentUser: null as {
    uid: string;
    displayName: string | null;
    isAdmin: boolean;
  } | null,
  selectedMembership: null as { communityNickname: string | null } | null,
}));

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({
    screenParam: h.screenParam,
    navigate: h.navigate,
  }),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: h.currentUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../../core/contexts/useSelectedCommunity', () => ({
  useSelectedCommunity: () => ({
    selectedMembership: h.selectedMembership,
    loading: false,
  }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: {
      profile: { defaultNickname: 'テスト', id: 'profile-1' },
      spaceNicknames: {},
      activeSpaceId: 'space-1',
    },
    setDefaultNickname: vi.fn(),
    setSpaceNickname: vi.fn(),
    getActiveSpace: () => ({ id: 'space-1', name: 'テストスペース', myHossiiEnabled: false }),
  }),
}));

vi.mock('../Navigation/TopRightMenu', () => ({
  TopRightMenu: () => <div data-testid="top-right-menu" />,
}));

vi.mock('./JoinedSpacesSection', () => ({
  JoinedSpacesSection: () => <div data-testid="joined-spaces-section" />,
}));

vi.mock('./CommunityPersonalSpacesSection', () => ({
  CommunityPersonalSpacesSection: () => <div data-testid="community-personal-spaces-section" />,
}));

vi.mock('./MyHossiiSettingsSection', () => ({
  MyHossiiSettingsSection: () => <div data-testid="my-hossii-settings-section" />,
}));

vi.mock('../Community/CommunitySwitcher', () => ({
  CommunitySwitcher: () => <div data-testid="community-switcher" />,
}));

describe('AccountScreen section routing', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.screenParam = undefined;
    h.currentUser = null;
    h.selectedMembership = null;
  });

  it('renders home section when screenParam is undefined', () => {
    h.screenParam = undefined;
    render(<AccountScreen />);

    expect(screen.getByTestId('account-section-home')).toBeTruthy();
    expect(screen.getByText('表示名')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByTestId('joined-spaces-section')).toBeNull();
  });

  it('renders profile section when screenParam is profile', () => {
    h.screenParam = 'profile';
    render(<AccountScreen />);

    expect(screen.getByTestId('account-section-profile')).toBeTruthy();
    expect(screen.getByText('アカウント情報')).toBeTruthy();
    expect(screen.queryByTestId('joined-spaces-section')).toBeNull();
  });

  it('renders spaces section when screenParam is spaces', () => {
    h.screenParam = 'spaces';
    render(<AccountScreen />);

    expect(screen.getByTestId('account-section-spaces')).toBeTruthy();
    expect(screen.getByTestId('joined-spaces-section')).toBeTruthy();
  });

  it('renders my-hossii section when screenParam is my-hossii', () => {
    h.screenParam = 'my-hossii';
    render(<AccountScreen />);

    expect(screen.getByTestId('account-section-my-hossii')).toBeTruthy();
    expect(screen.getByTestId('my-hossii-settings-section')).toBeTruthy();
  });
});
