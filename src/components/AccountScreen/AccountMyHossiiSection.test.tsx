// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AccountMyHossiiSection } from './AccountMyHossiiSection';

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: null }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: {
      profile: { id: 'p1', defaultNickname: '名前' },
      activeSpaceId: 'space-1',
    },
    getActiveSpace: () => ({ id: 'space-1', name: 'テスト', myHossiiEnabled: true }),
  }),
}));

vi.mock('./MyHossiiSettingsSection', () => ({
  MyHossiiSettingsSection: () => <div data-testid="my-hossii-settings-section" />,
}));

describe('AccountMyHossiiSection', () => {
  afterEach(cleanup);

  it('renders my hossii settings section', () => {
    render(<AccountMyHossiiSection />);

    expect(screen.getByTestId('account-section-my-hossii')).toBeTruthy();
    expect(screen.getByTestId('my-hossii-settings-section')).toBeTruthy();
    expect(screen.getByText('マイHossii')).toBeTruthy();
  });
});
