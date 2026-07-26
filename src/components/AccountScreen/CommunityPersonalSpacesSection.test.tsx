// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { CommunityPersonalSpacesSection } from './CommunityPersonalSpacesSection';
import type { Space } from '../../core/types/space';
import type { IssuedParticipantScopeResult } from '../../core/utils/participantAccountScopeApi';

const h = vi.hoisted(() => ({
  fetchAccountCommunityPersonalSpaces: vi.fn(),
  ensureMyPersonalSpace: vi.fn(),
  fetchPersonalSpaceForStore: vi.fn(),
  addSpaceLocal: vi.fn(),
  refreshMemberships: vi.fn(),
  currentUser: {
    uid: 'user-1',
    displayName: 'Test User',
    isAdmin: false,
    isIssuedParticipant: undefined as boolean | undefined,
  } as {
    uid: string;
    displayName: string;
    isAdmin: boolean;
    isIssuedParticipant?: boolean;
  } | null,
  communityLoading: false,
  issuedParticipantScope: null as IssuedParticipantScopeResult | null,
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: h.currentUser }),
}));

vi.mock('../../core/contexts/useSelectedCommunity', () => ({
  useSelectedCommunity: () => ({
    loading: h.communityLoading,
    issuedParticipantScope: h.issuedParticipantScope,
    refreshMemberships: h.refreshMemberships,
  }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({ addSpaceLocal: h.addSpaceLocal }),
}));

vi.mock('../../core/utils/personalSpacesApi', () => ({
  fetchAccountCommunityPersonalSpaces: h.fetchAccountCommunityPersonalSpaces,
  ensureMyPersonalSpace: h.ensureMyPersonalSpace,
  fetchPersonalSpaceForStore: h.fetchPersonalSpaceForStore,
}));

const COMMUNITY_A = 'comm-a';
const COMMUNITY_B = 'comm-b';

const issuedScopeOk: IssuedParticipantScopeResult = {
  ok: true,
  spaceId: 'space-issued',
  spaceName: '発行元スペース',
  spaceUrl: 'issued-space',
  isArchived: false,
  communityId: 'community-issued',
  communityName: '発行元コミュニティ',
  communitySlug: 'issued-community',
  spaceNickname: null,
  membershipId: 'm-issued',
  joinedAt: '2026-07-01T00:00:00.000Z',
};

function pendingItem(overrides: Partial<ReturnType<typeof baseItem>> = {}) {
  return {
    ...baseItem(COMMUNITY_A, 'Community A', 'admin'),
    personalSpaceId: null,
    personalSpaceUrl: null,
    personalSpaceStatus: null,
    ...overrides,
  };
}

function createdItem(
  communityId: string,
  communityName: string,
  overrides: Partial<ReturnType<typeof baseItem>> = {},
) {
  return {
    ...baseItem(communityId, communityName, 'member'),
    personalSpaceId: `ps-${communityId}`,
    personalSpaceUrl: `p-${communityId}`,
    personalSpaceStatus: 'active',
    ...overrides,
  };
}

function baseItem(communityId: string, communityName: string, membershipRole: 'admin' | 'member') {
  return {
    communityId,
    communityName,
    membershipStatus: 'active',
    membershipRole,
    personalSpaceId: null as string | null,
    personalSpaceUrl: null as string | null,
    personalSpaceStatus: null as string | null,
    personalSpaceIsArchived: false,
  };
}

const personalSpaceA: Space = {
  id: 'ps-comm-a',
  spaceURL: 'p-comm-a',
  name: '個人スペース',
  quickEmotions: [],
  createdAt: new Date('2026-01-01'),
  communityId: COMMUNITY_A,
  spaceType: 'personal',
  ownerUserId: 'user-1',
};

describe('CommunityPersonalSpacesSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.fetchAccountCommunityPersonalSpaces.mockReset();
    h.ensureMyPersonalSpace.mockReset();
    h.fetchPersonalSpaceForStore.mockReset();
    h.addSpaceLocal.mockReset();
    h.refreshMemberships.mockReset();
    h.currentUser = {
      uid: 'user-1',
      displayName: 'Test User',
      isAdmin: false,
    };
    h.communityLoading = false;
    h.issuedParticipantScope = null;
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([pendingItem()]);
    h.ensureMyPersonalSpace.mockResolvedValue({ ok: true, spaceId: 'ps-comm-a', spaceUrl: 'p-comm-a' });
    h.fetchPersonalSpaceForStore.mockResolvedValue(personalSpaceA);
  });

  it('active community ごとに行が表示される', async () => {
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
      pendingItem({ communityId: COMMUNITY_A, communityName: 'Community A', membershipRole: 'admin' }),
      pendingItem({ communityId: COMMUNITY_B, communityName: 'Community B', membershipRole: 'member' }),
    ]);
    render(<CommunityPersonalSpacesSection />);

    expect(await screen.findByText('Community A')).toBeTruthy();
    expect(screen.getByText('Community B')).toBeTruthy();
    expect(screen.getAllByText('マイスペース未作成')).toHaveLength(2);
  });

  it('membership role を表示する', async () => {
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
      pendingItem({ membershipRole: 'admin' }),
    ]);
    render(<CommunityPersonalSpacesSection />);
    expect(await screen.findByText('管理者')).toBeTruthy();
  });

  it('personal space 未作成では「マイスペースを作る」を表示する', async () => {
    render(<CommunityPersonalSpacesSection />);
    expect(await screen.findByRole('button', { name: /マイスペースを作る/ })).toBeTruthy();
    expect(screen.getByText('マイスペース未作成')).toBeTruthy();
    expect(screen.getByText(/共有スペースのマイスペースタブからも/)).toBeTruthy();
  });

  it('personal space ありでは案内文を表示し作成ボタンは出さない', async () => {
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([createdItem(COMMUNITY_A, 'Community A')]);
    render(<CommunityPersonalSpacesSection />);

    expect(await screen.findByText('マイスペースあり')).toBeTruthy();
    expect(screen.getByText(/共有スペースの「マイスペース」タブから利用できます/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /マイスペースを作る/ })).toBeNull();
  });

  it('archived personal space にアーカイブバッジを表示する', async () => {
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
      createdItem(COMMUNITY_A, 'Community A', { personalSpaceIsArchived: true }),
    ]);
    render(<CommunityPersonalSpacesSection />);

    expect(await screen.findByText('アーカイブ')).toBeTruthy();
    expect(screen.getByText('マイスペースあり')).toBeTruthy();
    expect(screen.getByText(/アーカイブ中 — 見ることはできます/)).toBeTruthy();
  });

  it('指定 community にだけ personal space を作成し、画面遷移しない', async () => {
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
      pendingItem({ communityId: COMMUNITY_A, communityName: 'Community A' }),
      pendingItem({ communityId: COMMUNITY_B, communityName: 'Community B' }),
    ]);
    render(<CommunityPersonalSpacesSection />);

    const buttons = await screen.findAllByRole('button', { name: /マイスペースを作る/ });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(h.ensureMyPersonalSpace).toHaveBeenCalledTimes(1);
      expect(h.ensureMyPersonalSpace).toHaveBeenCalledWith(COMMUNITY_A);
    });

    const rowA = screen.getByText('Community A').closest('li');
    expect(rowA).toBeTruthy();
    expect(within(rowA!).getByText('マイスペースあり')).toBeTruthy();

    const rowB = screen.getByText('Community B').closest('li');
    expect(rowB).toBeTruthy();
    expect(within(rowB!).getByText('マイスペース未作成')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('作成後に store と表示が即時更新される', async () => {
    render(<CommunityPersonalSpacesSection />);
    fireEvent.click(await screen.findByRole('button', { name: /マイスペースを作る/ }));

    await waitFor(() => {
      expect(h.fetchPersonalSpaceForStore).toHaveBeenCalledWith('p-comm-a');
      expect(h.addSpaceLocal).toHaveBeenCalledWith(personalSpaceA);
      expect(screen.getByText('マイスペースあり')).toBeTruthy();
    });
  });

  it('再実行しても重複作成しない（作成済みではボタン非表示）', async () => {
    render(<CommunityPersonalSpacesSection />);
    fireEvent.click(await screen.findByRole('button', { name: /マイスペースを作る/ }));
    await waitFor(() => expect(screen.getByText('マイスペースあり')).toBeTruthy());

    h.ensureMyPersonalSpace.mockClear();
    expect(screen.queryByRole('button', { name: /マイスペースを作る/ })).toBeNull();
    expect(h.ensureMyPersonalSpace).not.toHaveBeenCalled();
  });

  it('別 community へ影響しない（2 community 同時表示で片方だけ更新）', async () => {
    h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
      createdItem(COMMUNITY_B, 'Community B'),
      pendingItem({ communityId: COMMUNITY_A, communityName: 'Community A' }),
    ]);
    render(<CommunityPersonalSpacesSection />);
    fireEvent.click(await screen.findByRole('button', { name: /マイスペースを作る/ }));

    await waitFor(() => {
      expect(h.ensureMyPersonalSpace).toHaveBeenCalledWith(COMMUNITY_A);
      expect(h.addSpaceLocal).toHaveBeenCalledTimes(1);
    });

    const rowB = screen.getByText('Community B').closest('li');
    expect(within(rowB!).getByText('マイスペースあり')).toBeTruthy();
    expect(h.ensureMyPersonalSpace).not.toHaveBeenCalledWith(COMMUNITY_B);
  });

  describe('issued participant', () => {
    beforeEach(() => {
      h.currentUser = {
        uid: 'participant-1',
        displayName: 'Participant',
        isAdmin: false,
        isIssuedParticipant: true,
      };
      h.issuedParticipantScope = issuedScopeOk;
    });

    it('shows only the issuing space from context scope and does not call membership API', async () => {
      render(<CommunityPersonalSpacesSection />);

      expect(await screen.findByTestId('issued-participant-space-row')).toBeTruthy();
      expect(screen.getByText('発行元スペース')).toBeTruthy();
      expect(screen.getByText('発行元コミュニティ')).toBeTruthy();
      expect(screen.getByRole('link', { name: /開く/ })).toBeTruthy();
      expect(screen.queryByText('Community A')).toBeNull();
      expect(screen.queryByText('Community B')).toBeNull();
      expect(screen.queryByRole('button', { name: /マイスペースを作る/ })).toBeNull();
      expect(h.fetchAccountCommunityPersonalSpaces).not.toHaveBeenCalled();
    });

    it('does not fallback to membership list while scope is loading', async () => {
      h.communityLoading = true;
      h.issuedParticipantScope = null;
      h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
        pendingItem({ communityId: COMMUNITY_B, communityName: 'Other Community' }),
      ]);
      render(<CommunityPersonalSpacesSection />);

      expect(await screen.findByText('読み込み中…')).toBeTruthy();
      expect(screen.queryByText('Other Community')).toBeNull();
      expect(h.fetchAccountCommunityPersonalSpaces).not.toHaveBeenCalled();
    });

    it('does not fallback to membership list when scope fails', async () => {
      h.issuedParticipantScope = { ok: false, reason: 'not_found' };
      h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
        pendingItem({ communityId: COMMUNITY_B, communityName: 'Other Community' }),
      ]);
      render(<CommunityPersonalSpacesSection />);

      expect(await screen.findByText(/マイスペース情報の取得に失敗/)).toBeTruthy();
      expect(screen.queryByText('Other Community')).toBeNull();
      expect(h.fetchAccountCommunityPersonalSpaces).not.toHaveBeenCalled();
    });

    it('clears issued display when switching to a regular account', async () => {
      const { rerender } = render(<CommunityPersonalSpacesSection />);
      expect(await screen.findByText('発行元スペース')).toBeTruthy();

      h.currentUser = {
        uid: 'user-2',
        displayName: 'Regular',
        isAdmin: false,
        isIssuedParticipant: false,
      };
      h.issuedParticipantScope = null;
      h.fetchAccountCommunityPersonalSpaces.mockResolvedValue([
        pendingItem({ communityId: COMMUNITY_A, communityName: 'Community A' }),
        pendingItem({ communityId: COMMUNITY_B, communityName: 'Community B' }),
      ]);
      rerender(<CommunityPersonalSpacesSection />);

      expect(await screen.findByText('Community A')).toBeTruthy();
      expect(screen.getByText('Community B')).toBeTruthy();
      expect(screen.queryByText('発行元スペース')).toBeNull();
      expect(h.fetchAccountCommunityPersonalSpaces).toHaveBeenCalled();
    });
  });
});
