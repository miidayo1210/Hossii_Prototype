// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CommunitiesScreen } from './CommunitiesScreen';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setOverrideCommunity: vi.fn(),
  fetchAllCommunities: vi.fn(),
  superAdminCreateCommunity: vi.fn(),
  fetchCommunityStats: vi.fn(),
  currentUser: {
    uid: 'super-1',
    email: 'dev-super-admin@example.test',
    displayName: 'Dev Super Admin',
    isAdmin: true,
    isSuperAdmin: true,
  } as {
    uid: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
    isSuperAdmin?: boolean;
  } | null,
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: h.currentUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({
    navigate: h.navigate,
  }),
}));

vi.mock('../../core/contexts/useAdminNavigation', () => ({
  useAdminNavigation: () => ({
    setOverrideCommunity: h.setOverrideCommunity,
  }),
}));

vi.mock('../../core/utils/communitiesApi', () => ({
  fetchAllCommunities: (...args: unknown[]) => h.fetchAllCommunities(...args),
  superAdminCreateCommunity: (...args: unknown[]) => h.superAdminCreateCommunity(...args),
}));

vi.mock('../../core/utils/spacesApi', () => ({
  fetchCommunityStats: (...args: unknown[]) => h.fetchCommunityStats(...args),
}));

const sampleCommunity = {
  id: 'community-1',
  adminId: 'admin-1',
  name: 'Existing Community',
  slug: 'existing01',
  status: 'approved' as const,
  createdAt: new Date('2026-07-01'),
};

const createdCommunity = {
  id: 'community-new',
  adminId: 'super-1',
  name: 'New Community',
  slug: 'newslug1',
  status: 'approved' as const,
  createdAt: new Date('2026-07-24'),
};

describe('CommunitiesScreen create community', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.navigate.mockReset();
    h.setOverrideCommunity.mockReset();
    h.fetchAllCommunities.mockReset();
    h.superAdminCreateCommunity.mockReset();
    h.fetchCommunityStats.mockReset();
    h.currentUser = {
      uid: 'super-1',
      email: 'dev-super-admin@example.test',
      displayName: 'Dev Super Admin',
      isAdmin: true,
      isSuperAdmin: true,
    };
    h.fetchAllCommunities.mockResolvedValue([sampleCommunity]);
    h.fetchCommunityStats.mockResolvedValue({
      spaceCount: 1,
      lastActivityAt: new Date('2026-07-02'),
      totalPostCount: 3,
    });
  });

  it('shows create button for super admin', async () => {
    render(<CommunitiesScreen />);
    expect(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' })).toBeTruthy();
  });

  it('hides create button for non-super admin', async () => {
    h.currentUser = {
      uid: 'admin-1',
      email: 'dev-community-admin@example.test',
      displayName: 'Dev Community Admin',
      isAdmin: true,
      isSuperAdmin: false,
    };
    render(<CommunitiesScreen />);
    await screen.findByText('Existing Community');
    expect(screen.queryByRole('button', { name: '＋ 新しいコミュニティを作成' })).toBeNull();
  });

  it('disables submit for empty name', async () => {
    render(<CommunitiesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    expect(screen.getByRole('button', { name: '作成する' }).hasAttribute('disabled')).toBe(true);
  });

  it('submits trimmed name via RPC and navigates on success', async () => {
    h.superAdminCreateCommunity.mockResolvedValue({ ok: true, community: createdCommunity });
    h.fetchAllCommunities
      .mockResolvedValueOnce([sampleCommunity])
      .mockResolvedValueOnce([createdCommunity, sampleCommunity]);

    render(<CommunitiesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' }));

    const input = screen.getByLabelText('コミュニティ名');
    fireEvent.change(input, { target: { value: '  New Community  ' } });
    fireEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(h.superAdminCreateCommunity).toHaveBeenCalledWith('New Community');
    });
    await waitFor(() => {
      expect(h.setOverrideCommunity).toHaveBeenCalledWith(
        'community-new',
        'New Community',
        'newslug1',
      );
      expect(h.navigate).toHaveBeenCalledWith('spaces', 'newslug1');
    });
    expect(h.fetchAllCommunities).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prevents double submit while creating', async () => {
    let resolveCreate: ((value: { ok: true; community: typeof createdCommunity }) => void) | undefined;
    h.superAdminCreateCommunity.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<CommunitiesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    fireEvent.change(screen.getByLabelText('コミュニティ名'), {
      target: { value: 'Pending Community' },
    });
    fireEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '作成中...' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '作成中...' }));
    expect(h.superAdminCreateCommunity).toHaveBeenCalledTimes(1);

    resolveCreate?.({ ok: true, community: createdCommunity });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('shows generic error when RPC fails', async () => {
    h.superAdminCreateCommunity.mockResolvedValue({ ok: false });

    render(<CommunitiesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    fireEvent.change(screen.getByLabelText('コミュニティ名'), {
      target: { value: 'Broken Community' },
    });
    fireEvent.click(screen.getByRole('button', { name: '作成する' }));

    expect(
      await screen.findByText('コミュニティの作成に失敗しました。もう一度お試しください。'),
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes modal on cancel, backdrop click, and Escape', async () => {
    render(<CommunitiesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps modal open on Escape while submitting', async () => {
    let resolveCreate: ((value: { ok: true; community: typeof createdCommunity }) => void) | undefined;
    h.superAdminCreateCommunity.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<CommunitiesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ 新しいコミュニティを作成' }));
    fireEvent.change(screen.getByLabelText('コミュニティ名'), {
      target: { value: 'Hold Community' },
    });
    fireEvent.click(screen.getByRole('button', { name: '作成する' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '作成中...' })).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();

    resolveCreate?.({ ok: true, community: createdCommunity });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('still renders existing list and detail toggle', async () => {
    render(<CommunitiesScreen />);
    expect(await screen.findByText('Existing Community')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /詳細を見る/ }));
    await waitFor(() => {
      expect(screen.getByText('スペース数')).toBeTruthy();
    });
    expect(h.fetchCommunityStats).toHaveBeenCalledWith('community-1');
  });
});
