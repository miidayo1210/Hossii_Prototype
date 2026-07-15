// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { badgeForSection, useAccountHomeEntryBadges } from './useAccountHomeEntryBadges';

const h = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
  fetchMyJoinedSpaces: vi.fn(),
  fetchMyHossiiSettings: vi.fn(),
  isMyHossiiRegistered: vi.fn(),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: h.currentUser }),
}));

vi.mock('../../core/utils/joinedSpacesApi', () => ({
  fetchMyJoinedSpaces: h.fetchMyJoinedSpaces,
}));

vi.mock('../../core/utils/userProfilesApi', () => ({
  fetchMyHossiiSettings: h.fetchMyHossiiSettings,
  isMyHossiiRegistered: h.isMyHossiiRegistered,
}));

describe('useAccountHomeEntryBadges', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.currentUser = null;
    h.fetchMyJoinedSpaces.mockReset();
    h.fetchMyHossiiSettings.mockReset();
    h.isMyHossiiRegistered.mockReset();
  });

  it('returns null badges for guest', () => {
    const { result } = renderHook(() => useAccountHomeEntryBadges());
    expect(result.current).toEqual({ spaces: null, myHossii: null, loading: false });
  });

  it('loads spaces count and my hossii status for logged-in user', async () => {
    h.currentUser = { uid: 'user-1' };
    h.fetchMyJoinedSpaces.mockResolvedValue([{ id: '1' }, { id: '2' }]);
    h.fetchMyHossiiSettings.mockResolvedValue({ presetKey: 'basic-1' });
    h.isMyHossiiRegistered.mockReturnValue(true);

    const { result } = renderHook(() => useAccountHomeEntryBadges());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.spaces).toBe('2件');
    expect(result.current.myHossii).toBe('登録済み');
  });
});

describe('badgeForSection', () => {
  it('returns loading ellipsis', () => {
    expect(
      badgeForSection('spaces', { spaces: null, myHossii: null, loading: true }),
    ).toBe('…');
  });

  it('returns null for profile', () => {
    expect(
      badgeForSection('profile', { spaces: '1件', myHossii: '未登録', loading: false }),
    ).toBeNull();
  });
});
