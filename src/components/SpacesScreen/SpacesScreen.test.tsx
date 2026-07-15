// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SpacesScreen } from './SpacesScreen';
import type { Space } from '../../core/types/space';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setActiveSpace: vi.fn(),
  fetchPersonalSpaceOwnerLabels: vi.fn(),
  currentUser: {
    uid: 'admin-1',
    displayName: 'Admin',
    email: 'admin@example.test',
    isAdmin: true,
    isSuperAdmin: false,
    communityId: 'comm-a',
    communityName: 'Dev Community',
  },
  spaces: [] as Space[],
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: { spaces: h.spaces },
    addSpace: vi.fn(),
    updateSpace: vi.fn(),
    removeSpace: vi.fn(),
    setActiveSpace: h.setActiveSpace,
    communitySlug: 'dev-community',
    spacesLoadedFromSupabase: true,
  }),
}));

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({ navigate: h.navigate, screenParam: null }),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: h.currentUser,
    logout: vi.fn(),
    refreshCommunitySlug: vi.fn(),
  }),
}));

vi.mock('../../core/contexts/useAdminNavigation', () => ({
  useAdminNavigation: () => ({
    overrideCommunityId: null,
    overrideCommunityName: null,
    clearOverrideCommunity: vi.fn(),
    setOverrideCommunity: vi.fn(),
  }),
}));

vi.mock('./PersonalSpaceTemplateEditor', () => ({
  PersonalSpaceTemplateEditor: () => <div data-testid="template-editor" />,
}));

vi.mock('../../core/utils/personalSpaceOwnerLabelsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/utils/personalSpaceOwnerLabelsApi')>();
  return {
    ...actual,
    fetchPersonalSpaceOwnerLabels: h.fetchPersonalSpaceOwnerLabels,
  };
});

function space(partial: Partial<Space> & Pick<Space, 'id' | 'name'>): Space {
  return {
    quickEmotions: [],
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('SpacesScreen admin personal space list', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.navigate.mockReset();
    h.setActiveSpace.mockReset();
    h.fetchPersonalSpaceOwnerLabels.mockReset();
    h.fetchPersonalSpaceOwnerLabels.mockResolvedValue(
      new Map([
        [
          'owner-1',
          {
            communityNickname: '田中',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: null,
          },
        ],
        [
          'owner-2',
          {
            communityNickname: null,
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: null,
          },
        ],
      ]),
    );

    h.spaces = [
      space({ id: 'shared-1', name: 'Team Space', communityId: 'comm-a', spaceType: 'shared', spaceURL: 'team' }),
      space({
        id: 'ps-1',
        name: 'マイスペース',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-1',
        spaceURL: 'p-1',
      }),
      space({
        id: 'ps-2',
        name: 'マイスペース',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-2',
        spaceURL: 'p-2',
        isArchived: true,
      }),
      space({
        id: 'ps-other',
        name: 'Other',
        communityId: 'comm-b',
        spaceType: 'personal',
        ownerUserId: 'owner-x',
      }),
    ];
  });

  it('shared と personal を別セクションに分ける', () => {
    render(<SpacesScreen />);
    expect(screen.getByRole('heading', { name: '共有スペース' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /個人スペース/ })).toBeTruthy();
    expect(screen.getByText('Team Space')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('個人スペースは初期状態で閉じ、件数を表示する', () => {
    render(<SpacesScreen />);
    expect(screen.getByText('2件')).toBeTruthy();
    expect(screen.queryByText('田中さん')).toBeNull();
  });

  it('展開すると所有者名とアーカイブバッジが表示される', async () => {
    render(<SpacesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    await waitFor(() => {
      expect(screen.getByText('田中さん')).toBeTruthy();
    });
    expect(screen.getByText('名前未設定')).toBeTruthy();
    expect(screen.getAllByText('アーカイブ').length).toBeGreaterThan(0);
  });

  it('開く・設定が正しい space を参照する', async () => {
    const locationRef = { href: 'http://localhost/' };
    vi.stubGlobal('location', locationRef);

    render(<SpacesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    await waitFor(() => expect(screen.getByText('田中さん')).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: '開く' })[0]);
    expect(locationRef.href).toBe('/c/dev-community/s/p-1#screen');

    fireEvent.click(screen.getAllByRole('button', { name: '設定' })[0]);
    expect(h.setActiveSpace).toHaveBeenCalledWith('ps-1');
    expect(h.navigate).toHaveBeenCalledWith('settings');

    vi.unstubAllGlobals();
  });
});
