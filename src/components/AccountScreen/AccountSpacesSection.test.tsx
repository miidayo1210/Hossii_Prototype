// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AccountSpacesSection } from './AccountSpacesSection';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  currentUser: null as {
    uid: string;
    displayName: string;
    isAdmin: boolean;
    isIssuedParticipant?: boolean;
  } | null,
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

vi.mock('./IssuedParticipantCommunityPanel', () => ({
  IssuedParticipantCommunityPanel: () => <div data-testid="issued-participant-community" />,
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

  it('shows community switcher when logged in as a regular account', () => {
    h.currentUser = { uid: 'u1', displayName: 'User', isAdmin: false };
    render(<AccountSpacesSection />);

    expect(screen.getByTestId('community-switcher')).toBeTruthy();
    expect(screen.queryByTestId('issued-participant-community')).toBeNull();
  });

  it('hides community switcher for issued participant accounts', () => {
    h.currentUser = {
      uid: 'p1',
      displayName: 'Participant',
      isAdmin: false,
      isIssuedParticipant: true,
    };
    render(<AccountSpacesSection />);

    expect(screen.queryByTestId('community-switcher')).toBeNull();
    expect(screen.getByTestId('issued-participant-community')).toBeTruthy();
    expect(screen.getByText('参加IDで発行されたコミュニティです。')).toBeTruthy();
    expect(screen.getByText('参加IDで発行されたスペースです。')).toBeTruthy();
  });

  it('shows my-space intro copy in personal spaces section description', () => {
    h.currentUser = { uid: 'u1', displayName: 'User', isAdmin: false };
    render(<AccountSpacesSection />);

    expect(screen.getByText(/コミュニティごとに、自分だけのマイスペースがあります/)).toBeTruthy();
    expect(screen.getByText(/未作成の場合はここから作れます/)).toBeTruthy();
  });
});
