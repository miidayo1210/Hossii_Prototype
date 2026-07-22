// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Hossii } from '../../core/types';
import { LIKE_MUTATION_ERROR_MESSAGE } from '../../core/utils/likeMutationUi';

const mockState = vi.hoisted(() => ({
  currentUser: null as { uid: string; isAdmin: boolean } | null,
  likesEnabled: true,
  readOnlyArchived: false,
  updateLikeCount: vi.fn(),
  mutateLike: vi.fn(),
  onLikeCountUpdated: vi.fn(),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: mockState.currentUser }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: { spaces: [{ id: 's1' }] },
    hideHossii: () => {},
    getActiveNickname: () => 'Tester',
    getAuthorId: () => 'guest-device-1',
    myAuthorshipIds: new Set<string>(),
    myAuthorshipIdsStatus: 'ready',
    postAuthorDisplayNames: new Map<string, string>(),
    updateHossiiLikeCountAction: mockState.updateLikeCount,
  }),
}));

vi.mock('../../core/hooks/useHossiiActions', () => ({
  useHossiiActions: () => ({
    editMyHossiiContent: async () => ({ ok: true }),
    setMyHossiiVisibilityAction: async () => ({ ok: true }),
    softDeleteMyHossiiAction: async () => ({ ok: true }),
  }),
}));

vi.mock('../../core/hooks/useSpaceSettings', () => ({
  useSpaceSettings: () => ({
    spaceSettings: {
      features: { likesEnabled: mockState.likesEnabled },
    },
  }),
}));

vi.mock('../../core/utils/filterStorage', () => ({
  loadFilters: () => ({ comment: true, emotion: true }),
  saveFilters: () => {},
}));

vi.mock('../../core/utils/logScopeStorage', () => ({
  loadLogScope: () => 'all',
  saveLogScope: () => {},
}));

vi.mock('../../core/utils/likesApi', () => ({
  fetchLikedIds: vi.fn(async () => new Set<string>()),
  mutateLike: (...args: unknown[]) => mockState.mutateLike(...args),
}));

import { fetchLikedIds } from '../../core/utils/likesApi';
import { LogListBody } from './LogListBody';

function makeHossii(over: Partial<Hossii> & { id: string }): Hossii {
  return {
    id: over.id,
    spaceId: over.spaceId ?? 's1',
    message: over.message ?? `msg-${over.id}`,
    authorId: over.authorId ?? null,
    createdAt: over.createdAt ?? new Date('2026-07-01T00:00:00Z'),
    likeCount: over.likeCount ?? 0,
    ...over,
  } as Hossii;
}

beforeEach(() => {
  mockState.currentUser = null;
  mockState.likesEnabled = true;
  mockState.readOnlyArchived = false;
  mockState.updateLikeCount.mockReset();
  mockState.mutateLike.mockReset();
  mockState.onLikeCountUpdated.mockReset();
  mockState.mutateLike.mockResolvedValue({ liked: true, likeCount: 1 });
  vi.mocked(fetchLikedIds).mockReset();
  vi.mocked(fetchLikedIds).mockResolvedValue(new Set<string>());
});

afterEach(() => cleanup());

describe('LogListBody like mutations', () => {
  it('guest calls mutateLike(id, undefined)', async () => {
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1' })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'いいね' }));
    await waitFor(() => {
      expect(mockState.mutateLike).toHaveBeenCalledWith('h1', undefined);
    });
  });

  it('logged-in calls mutateLike(id, uid)', async () => {
    mockState.currentUser = { uid: 'user-1', isAdmin: false };
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1' })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'いいね' }));
    await waitFor(() => {
      expect(mockState.mutateLike).toHaveBeenCalledWith('h1', 'user-1');
    });
  });

  it('logged-in toggle 0→1→0', async () => {
    mockState.currentUser = { uid: 'user-1', isAdmin: false };
    mockState.mutateLike
      .mockResolvedValueOnce({ liked: true, likeCount: 1 })
      .mockResolvedValueOnce({ liked: false, likeCount: 0 });
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 0 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );
    const button = screen.getByRole('button', { name: 'いいね' });
    fireEvent.click(button);
    await waitFor(() => expect(button.textContent).toContain('1'));
    fireEvent.click(screen.getByRole('button', { name: 'いいねを取り消す' }));
    await waitFor(() => expect(button.textContent).toContain('0'));
  });

  it('guest increment updates displayed count', async () => {
    mockState.mutateLike.mockResolvedValue({ liked: true, likeCount: 3 });
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 2 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'いいね' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'いいね' }).textContent).toContain('3');
    });
  });

  it('rolls back and shows error on failure', async () => {
    mockState.mutateLike.mockRejectedValue(new Error('boom'));
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 2 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'いいね' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(LIKE_MUTATION_ERROR_MESSAGE);
      expect(screen.getByRole('button', { name: 'いいね' }).textContent).toContain('2');
    });
  });

  it('logged-in unlike 28→27 stays at 27 after store sync (no double delta)', async () => {
    mockState.currentUser = { uid: 'user-1', isAdmin: false };
    vi.mocked(fetchLikedIds).mockResolvedValue(new Set(['h1']));
    mockState.mutateLike.mockResolvedValue({ liked: false, likeCount: 27 });

    const { rerender } = render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 28 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'いいねを取り消す' }).textContent).toContain('28');
    });

    const button = screen.getByRole('button', { name: 'いいねを取り消す' });
    fireEvent.click(button);

    await waitFor(() => expect(mockState.mutateLike).toHaveBeenCalledTimes(1));

    rerender(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 27 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'いいね' }).textContent).toContain('27');
      expect(screen.getByRole('button', { name: 'いいね' }).textContent).not.toContain('26');
    });
    expect(mockState.updateLikeCount).toHaveBeenCalledWith('h1', 27);
  });

  it('logged-in like 27→28 stays at 28 after store sync (no double delta)', async () => {
    mockState.currentUser = { uid: 'user-1', isAdmin: false };
    mockState.mutateLike.mockResolvedValue({ liked: true, likeCount: 28 });

    const { rerender } = render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 27 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );

    const button = screen.getByRole('button', { name: 'いいね' });
    expect(button.textContent).toContain('27');
    fireEvent.click(button);

    await waitFor(() => expect(mockState.mutateLike).toHaveBeenCalledTimes(1));

    rerender(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 28 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'いいねを取り消す' }).textContent).toContain('28');
      expect(screen.getByRole('button', { name: 'いいねを取り消す' }).textContent).not.toContain('29');
    });
  });

  it('ignores rapid clicks while pending (single mutateLike)', async () => {
    mockState.currentUser = { uid: 'user-1', isAdmin: false };
    vi.mocked(fetchLikedIds).mockResolvedValue(new Set(['h1']));
    let resolveMutate!: (v: { liked: boolean; likeCount: number }) => void;
    mockState.mutateLike.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutate = resolve;
        }),
    );

    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 28 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );

    await waitFor(() => screen.getByRole('button', { name: 'いいねを取り消す' }));
    const button = screen.getByRole('button', { name: 'いいねを取り消す' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockState.mutateLike).toHaveBeenCalledTimes(1);

    resolveMutate({ liked: false, likeCount: 27 });
    await waitFor(() => expect(button.textContent).toContain('27'));
  });

  it('calls onLikeCountUpdated on success', async () => {
    mockState.mutateLike.mockResolvedValue({ liked: true, likeCount: 4 });
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1' })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
        onLikeCountUpdated={mockState.onLikeCountUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'いいね' }));
    await waitFor(() => {
      expect(mockState.onLikeCountUpdated).toHaveBeenCalledWith('h1', 4);
    });
  });

  it('refetches liked ids when hossiis load after auth', async () => {
    vi.mocked(fetchLikedIds).mockResolvedValue(new Set(['h1']));
    mockState.currentUser = { uid: 'user-1', isAdmin: false };
    const { rerender } = render(
      <LogListBody hossiis={[]} spaceId="s1" panelMode initialLogScope="all" />,
    );
    expect(fetchLikedIds).not.toHaveBeenCalled();

    rerender(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 0 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );

    await waitFor(() => {
      expect(fetchLikedIds).toHaveBeenCalledWith('user-1', ['h1']);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'いいねを取り消す' })).toBeTruthy();
    });
  });

  it('hides like button when likesEnabled is OFF', () => {
    mockState.likesEnabled = false;
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 5 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
      />,
    );
    expect(screen.queryByRole('button', { name: 'いいね' })).toBeNull();
    expect(screen.getByText('🤍 5')).toBeTruthy();
  });

  it('hides like button when archived read-only', () => {
    render(
      <LogListBody
        hossiis={[makeHossii({ id: 'h1', likeCount: 2 })]}
        spaceId="s1"
        panelMode
        initialLogScope="all"
        readOnlyArchived
      />,
    );
    expect(screen.queryByRole('button', { name: 'いいね' })).toBeNull();
    expect(screen.getByText('🤍 2')).toBeTruthy();
  });
});
