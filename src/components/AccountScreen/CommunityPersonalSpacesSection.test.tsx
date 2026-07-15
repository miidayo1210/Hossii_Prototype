// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CommunityPersonalSpacesSection } from './CommunityPersonalSpacesSection';
import type { Space } from '../../core/types/space';

const h = vi.hoisted(() => ({
  fetchMyCommunityPersonalSpaces: vi.fn(),
  ensureMyPersonalSpace: vi.fn(),
  fetchPersonalSpaceForStore: vi.fn(),
  addSpaceLocal: vi.fn(),
  currentUser: { uid: 'user-1', displayName: 'Test User', isAdmin: false },
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: h.currentUser }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({ addSpaceLocal: h.addSpaceLocal }),
}));

vi.mock('../../core/utils/personalSpacesApi', () => ({
  fetchMyCommunityPersonalSpaces: h.fetchMyCommunityPersonalSpaces,
  ensureMyPersonalSpace: h.ensureMyPersonalSpace,
  fetchPersonalSpaceForStore: h.fetchPersonalSpaceForStore,
}));

const COMMUNITY_ID = 'comm-1';

function pendingItem() {
  return {
    communityId: COMMUNITY_ID,
    communityName: 'Dev Community',
    membershipStatus: 'active',
    personalSpaceId: null,
    personalSpaceUrl: null,
    personalSpaceStatus: null,
  };
}

function createdItem() {
  return {
    ...pendingItem(),
    personalSpaceId: 'ps-1',
    personalSpaceUrl: 'p-abc',
    personalSpaceStatus: 'active',
  };
}

const personalSpace: Space = {
  id: 'ps-1',
  spaceURL: 'p-abc',
  name: '個人スペース',
  quickEmotions: [],
  createdAt: new Date('2026-01-01'),
  communityId: COMMUNITY_ID,
  spaceType: 'personal',
  ownerUserId: 'user-1',
};

describe('CommunityPersonalSpacesSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.fetchMyCommunityPersonalSpaces.mockReset();
    h.ensureMyPersonalSpace.mockReset();
    h.fetchPersonalSpaceForStore.mockReset();
    h.addSpaceLocal.mockReset();
    h.fetchMyCommunityPersonalSpaces.mockResolvedValue([pendingItem()]);
    h.ensureMyPersonalSpace.mockResolvedValue({ ok: true, spaceId: 'ps-1', spaceUrl: 'p-abc' });
    h.fetchPersonalSpaceForStore.mockResolvedValue(personalSpace);
  });

  it('未作成状態では作成ボタンを表示する', async () => {
    render(<CommunityPersonalSpacesSection />);
    expect(await screen.findByRole('button', { name: /個人スペースを作る/ })).toBeTruthy();
  });

  it('作成後はアカウント画面に留まり、作成済みバッジを表示する（/s へのリンクなし）', async () => {
    render(<CommunityPersonalSpacesSection />);
    const btn = await screen.findByRole('button', { name: /個人スペースを作る/ });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('作成済み')).toBeTruthy();
    });
    expect(screen.queryByRole('link', { name: /開く/ })).toBeNull();
    expect(document.querySelector('a[href^="/s/"]')).toBeNull();
    expect(screen.getByText(/マイスペースがあります/)).toBeTruthy();
  });

  it('作成時に ensure を呼び、取得した personal space を store へ merge する', async () => {
    render(<CommunityPersonalSpacesSection />);
    fireEvent.click(await screen.findByRole('button', { name: /個人スペースを作る/ }));

    await waitFor(() => {
      expect(h.ensureMyPersonalSpace).toHaveBeenCalledWith(COMMUNITY_ID);
      expect(h.fetchPersonalSpaceForStore).toHaveBeenCalledWith('p-abc');
      expect(h.addSpaceLocal).toHaveBeenCalledWith(personalSpace);
    });
  });

  it('作成済み表示では作成ボタンを出さない', async () => {
    h.fetchMyCommunityPersonalSpaces.mockResolvedValue([createdItem()]);
    render(<CommunityPersonalSpacesSection />);
    expect(await screen.findByText('作成済み', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /個人スペースを作る/ })).toBeNull();
  });

  it('再実行しても ensure は冪等 RPC に委ねる（UI は作成済みのまま）', async () => {
    render(<CommunityPersonalSpacesSection />);
    fireEvent.click(await screen.findByRole('button', { name: /個人スペースを作る/ }));
    await waitFor(() => expect(screen.getByText('作成済み')).toBeTruthy());

    h.ensureMyPersonalSpace.mockClear();
    expect(screen.queryByRole('button', { name: /個人スペースを作る/ })).toBeNull();
    expect(h.ensureMyPersonalSpace).not.toHaveBeenCalled();
  });
});
