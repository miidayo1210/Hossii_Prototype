// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AccountSpacesSection } from './AccountSpacesSection';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  currentUser: null as { uid: string; displayName: string; isAdmin: boolean } | null,
}));

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({ navigate: h.navigate }),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: h.currentUser }),
}));

vi.mock('../Community/CommunitySwitcher', () => ({
  CommunitySwitcher: () => <div data-testid="community-switcher" />,
}));

vi.mock('./JoinedSpacesSection', () => ({
  JoinedSpacesSection: () => <div data-testid="joined-spaces-section" />,
}));

vi.mock('./CommunityPersonalSpacesSection', () => ({
  CommunityPersonalSpacesSection: () => <div data-testid="community-personal-spaces-section" />,
}));

describe('AccountSpacesSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.currentUser = null;
  });

  it('shows joined spaces sections for guest with login guidance via child components', () => {
    render(<AccountSpacesSection />);

    expect(screen.getByTestId('account-section-spaces')).toBeTruthy();
    expect(screen.getByTestId('joined-spaces-section')).toBeTruthy();
    expect(screen.getByTestId('community-personal-spaces-section')).toBeTruthy();
    expect(screen.queryByTestId('community-switcher')).toBeNull();
  });

  it('shows community switcher when logged in', () => {
    h.currentUser = { uid: 'u1', displayName: 'User', isAdmin: false };
    render(<AccountSpacesSection />);

    expect(screen.getByTestId('community-switcher')).toBeTruthy();
  });
});
