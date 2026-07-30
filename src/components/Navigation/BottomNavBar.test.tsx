// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const useHasPublishedChallengeProgramsMock = vi.hoisted(() => vi.fn());

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({
    screen: 'screen',
    navigate: vi.fn(),
  }),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1' },
  }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: { activeSpaceId: 'space-1' },
  }),
}));

vi.mock('../../core/hooks/useHasPublishedChallengePrograms', () => ({
  useHasPublishedChallengePrograms: (...args: unknown[]) =>
    useHasPublishedChallengeProgramsMock(...args),
}));

import { BottomNavBar } from './BottomNavBar';

describe('BottomNavBar challenge entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hides 挑戦状 when no published programs', () => {
    useHasPublishedChallengeProgramsMock.mockReturnValue(false);
    render(<BottomNavBar />);
    expect(screen.queryByRole('button', { name: '挑戦状' })).toBeNull();
    expect(screen.getByRole('button', { name: 'スペース' })).toBeTruthy();
  });

  it('shows 挑戦状 when published programs exist', () => {
    useHasPublishedChallengeProgramsMock.mockReturnValue(true);
    render(<BottomNavBar />);
    expect(screen.getByRole('button', { name: '挑戦状' })).toBeTruthy();
  });
});
