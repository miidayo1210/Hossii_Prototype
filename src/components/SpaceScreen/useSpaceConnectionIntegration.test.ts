// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AppUser } from '../../core/contexts/AuthContext';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import type { Hossii } from '../../core/types';
import type { Space } from '../../core/types/space';
import type { ConnectionOverlayInputs } from './useConnectionOverlayInputs';
import { useSpaceConnectionIntegration } from './useSpaceConnectionIntegration';
import {
  createConnection,
  deleteConnection,
  updateConnectionStrength,
} from '../../core/utils/hossiiConnectionsApi';

vi.mock('../../core/utils/hossiiConnectionsApi', () => ({
  createConnection: vi.fn(),
  updateConnectionStrength: vi.fn(),
  deleteConnection: vi.fn(),
}));

const mockedCreate = vi.mocked(createConnection);
const mockedUpdate = vi.mocked(updateConnectionStrength);
const mockedDelete = vi.mocked(deleteConnection);

function makeHossii(id: string, message = 'msg'): Hossii {
  return {
    id,
    message,
    authorName: 'author',
    createdAt: new Date('2026-07-01'),
    visibility: 'public',
  } as Hossii;
}

function makeConnection(overrides: Partial<HossiiConnection> = {}): HossiiConnection {
  return {
    id: 'conn-1',
    spaceId: 'space-1',
    paneId: 'pane-1',
    sourceHossiiId: 'h1',
    targetHossiiId: 'h2',
    strength: 'medium',
    createdBy: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

function makeSpace(overrides: Partial<Space> = {}): Space {
  return {
    id: 'space-1',
    name: 'Test Space',
    communityId: 'comm-1',
    ...overrides,
  } as Space;
}

function makeAdminUser(): AppUser {
  return {
    uid: 'admin-1',
    email: 'admin@test',
    displayName: 'Admin',
    isAdmin: true,
    communityId: 'comm-1',
  };
}

function makeParticipantUser(): AppUser {
  return {
    uid: 'user-1',
    email: 'user@test',
    displayName: 'User',
    isAdmin: false,
    communityId: 'comm-1',
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeOverlayInputs(
  overrides: Partial<ConnectionOverlayInputs> = {},
): ConnectionOverlayInputs {
  return {
    overlayProps: {
      bubbleAreaRef: { current: null },
      connections: [],
      selectedBubbleId: 'h1',
      renderAsStar: false,
      viewMode: 'full',
      presentationMode: 'custom',
      layoutMode: 'random',
      activePaneId: 'pane-1',
      visibleHossiiIds: new Set(['h1', 'h2']),
      directConnectionCount: 0,
      ...overrides.overlayProps,
    },
    selectedDirectConnectionCount: 0,
    connections: [],
    refetch: vi.fn(),
    isConnectionsContextEnabled: true,
    connectionBadgeCountByHossiiId: new Map(),
    ...overrides,
  };
}

type HookOptions = Parameters<typeof useSpaceConnectionIntegration>[0];

function makeOptions(overrides: Partial<HookOptions> = {}): HookOptions {
  const setSelectedBubbleId = vi.fn();
  const setActiveBubbleId = vi.fn();
  const resetBubbleInteraction = vi.fn();
  const closeBubbleActionMenu = vi.fn();
  const getBubbleActionMenuProps = vi.fn((_id: string, selected: boolean) => ({
    actionMenuEnabled: selected,
    actionMenuOpen: false,
    onActionMenuToggle: vi.fn(),
    onViewDetail: vi.fn(),
  }));

  return {
    currentUser: makeAdminUser(),
    activeSpace: makeSpace(),
    isContentArchived: false,
    spaceId: 'space-1',
    paneId: 'pane-1',
    selectedBubbleId: 'h1',
    setSelectedBubbleId,
    setActiveBubbleId,
    resetBubbleInteraction,
    closeBubbleActionMenu,
    getBubbleActionMenuProps,
    overlayInputs: makeOverlayInputs(),
    filteredHossiis: [makeHossii('h1'), makeHossii('h2'), makeHossii('h3')],
    layoutMode: 'random',
    viewMode: 'full',
    presentationMode: 'custom',
    contextActivePaneId: 'pane-1',
    ...overrides,
  };
}

describe('useSpaceConnectionIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreate.mockResolvedValue({
      ok: true,
      connection: makeConnection(),
    });
    mockedUpdate.mockResolvedValue({
      ok: true,
      connection: makeConnection({ strength: 'strong' }),
    });
    mockedDelete.mockResolvedValue({ ok: true, id: 'conn-1' });
  });

  describe('write gate (admin / participant / archived)', () => {
    it('allows connect and overlay edit for community admin', () => {
      const options = makeOptions();
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      expect(result.current.canWriteConnections).toBe(true);
      const menu = result.current.getIntegratedBubbleActionMenuProps('h1', true);
      expect(menu.onConnect).toBeTypeOf('function');
      expect(result.current.overlayProps.onConnectionClick).toBeTypeOf('function');
    });

    it('blocks write actions for participants', () => {
      const options = makeOptions({ currentUser: makeParticipantUser() });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      expect(result.current.canWriteConnections).toBe(false);
      const menu = result.current.getIntegratedBubbleActionMenuProps('h1', true);
      expect(menu.onConnect).toBeUndefined();
      expect(result.current.overlayProps.onConnectionClick).toBeUndefined();
    });

    it('blocks write actions when space content is archived', () => {
      const options = makeOptions({ isContentArchived: true });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      expect(result.current.canWriteConnections).toBe(false);
      const menu = result.current.getIntegratedBubbleActionMenuProps('h1', true);
      expect(menu.onConnect).toBeUndefined();
    });
  });

  describe('API mutations refetch', () => {
    it('refetches after create success', async () => {
      const refetch = vi.fn();
      const options = makeOptions({
        overlayInputs: makeOverlayInputs({ refetch }),
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startCreate('h1');
        result.current.editor.chooseTarget('h2');
      });

      await act(async () => {
        await result.current.editor.submitCreate();
      });

      expect(mockedCreate).toHaveBeenCalledWith({
        spaceId: 'space-1',
        paneId: 'pane-1',
        sourceHossiiId: 'h1',
        targetHossiiId: 'h2',
        strength: 'medium',
      });
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('refetches after update success', async () => {
      const refetch = vi.fn();
      const options = makeOptions({
        overlayInputs: makeOverlayInputs({ refetch }),
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startEdit(makeConnection());
        result.current.editor.chooseStrength('strong');
      });

      await act(async () => {
        await result.current.editor.submitStrengthUpdate();
      });

      expect(mockedUpdate).toHaveBeenCalledWith('conn-1', 'strong');
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('refetches after delete success even when zero rows deleted at API layer', async () => {
      const refetch = vi.fn();
      mockedDelete.mockResolvedValue({ ok: true, id: 'missing-id' });
      const options = makeOptions({
        overlayInputs: makeOverlayInputs({ refetch }),
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startEdit(makeConnection({ id: 'missing-id' }));
        result.current.editor.requestDelete();
      });

      await act(async () => {
        await result.current.editor.confirmDelete();
      });

      expect(mockedDelete).toHaveBeenCalledWith('missing-id');
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('does not refetch and surfaces error on API failure', async () => {
      const refetch = vi.fn();
      mockedCreate.mockResolvedValue({
        ok: false,
        message: 'permission denied',
        code: '42501',
      });
      const options = makeOptions({
        overlayInputs: makeOverlayInputs({ refetch }),
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startCreate('h1');
        result.current.editor.chooseTarget('h2');
      });

      await act(async () => {
        await result.current.editor.submitCreate();
      });

      expect(refetch).not.toHaveBeenCalled();
      expect(result.current.editor.phase).toBe('error');
      expect(result.current.editor.errorMessage).toBe('permission denied');
    });
  });

  describe('saving guard', () => {
    it('blocks reset, escape, and bubble select while saving', async () => {
      const deferred = createDeferred<Awaited<ReturnType<typeof createConnection>>>();
      mockedCreate.mockImplementation(() => deferred.promise);

      const options = makeOptions();
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startCreate('h1');
        result.current.editor.chooseTarget('h2');
      });

      act(() => {
        void result.current.editor.submitCreate();
      });

      expect(result.current.shouldAllowBubbleReset()).toBe(false);

      act(() => {
        result.current.resetConnectionState();
        result.current.handleEscapeReset();
        result.current.handleBubbleSelect('h3');
      });

      expect(options.resetBubbleInteraction).not.toHaveBeenCalled();
      expect(options.setSelectedBubbleId).not.toHaveBeenCalledWith('h3');

      deferred.resolve({ ok: true, connection: makeConnection() });
      await waitFor(() => {
        expect(result.current.editor.phase).toBe('idle');
      });
    });
  });

  describe('error recovery', () => {
    it('clears editor on escape while in error phase', async () => {
      mockedCreate.mockResolvedValue({ ok: false, message: 'failed' });
      const options = makeOptions();
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startCreate('h1');
        result.current.editor.chooseTarget('h2');
      });
      await act(async () => {
        await result.current.editor.submitCreate();
      });
      expect(result.current.editor.phase).toBe('error');

      act(() => {
        result.current.handleEscapeReset();
      });
      expect(result.current.editor.phase).toBe('idle');
    });

    it('clears error and selects another bubble on background select', async () => {
      mockedCreate.mockResolvedValue({ ok: false, message: 'failed' });
      const options = makeOptions();
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startCreate('h1');
        result.current.editor.chooseTarget('h2');
      });
      await act(async () => {
        await result.current.editor.submitCreate();
      });

      act(() => {
        result.current.handleBubbleSelect('h3');
      });

      expect(result.current.editor.phase).toBe('idle');
      expect(options.setSelectedBubbleId).toHaveBeenCalledWith('h3');
      expect(options.setActiveBubbleId).toHaveBeenCalledWith(null);
    });
  });

  describe('connection list (1-hop / direction / visibility / pane)', () => {
    it('lists only direct peers in active pane with visible endpoints', () => {
      const connections = [
        makeConnection({ id: 'c1', sourceHossiiId: 'h1', targetHossiiId: 'h2' }),
        makeConnection({ id: 'c2', sourceHossiiId: 'h2', targetHossiiId: 'h3' }),
        makeConnection({
          id: 'c3',
          paneId: 'pane-2',
          sourceHossiiId: 'h1',
          targetHossiiId: 'h2',
        }),
      ];
      const options = makeOptions({
        selectedBubbleId: 'h1',
        overlayInputs: makeOverlayInputs({
          connections,
          selectedDirectConnectionCount: 1,
        }),
        filteredHossiis: [makeHossii('h1'), makeHossii('h2')],
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      expect(result.current.connectionListItems).toHaveLength(1);
      expect(result.current.connectionListItems[0]?.peerHossiiId).toBe('h2');
    });

    it('resolves peer regardless of source/target direction', () => {
      const connections = [
        makeConnection({ id: 'c1', sourceHossiiId: 'h2', targetHossiiId: 'h1' }),
      ];
      const options = makeOptions({
        selectedBubbleId: 'h1',
        overlayInputs: makeOverlayInputs({
          connections,
          selectedDirectConnectionCount: 1,
        }),
        filteredHossiis: [makeHossii('h1'), makeHossii('h2')],
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      expect(result.current.connectionListItems[0]?.peerHossiiId).toBe('h2');
    });
  });

  describe('connection list selection', () => {
    it('selects peer bubble when list item is chosen', () => {
      const connections = [
        makeConnection({ id: 'c1', sourceHossiiId: 'h1', targetHossiiId: 'h2' }),
      ];
      const options = makeOptions({
        selectedBubbleId: 'h1',
        overlayInputs: makeOverlayInputs({
          connections,
          selectedDirectConnectionCount: 1,
        }),
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.getIntegratedBubbleActionMenuProps('h1', true).onConnectionsClick?.();
      });
      expect(result.current.connectionListOpen).toBe(true);

      act(() => {
        result.current.handleConnectionListSelect('h2');
      });

      expect(options.setSelectedBubbleId).toHaveBeenCalledWith('h2');
      expect(result.current.connectionListOpen).toBe(false);
    });
  });

  describe('connections context gate (UI disabled)', () => {
    it('hides connection menu and overlay edit when context gate is off', () => {
      const options = makeOptions({
        overlayInputs: makeOverlayInputs({
          isConnectionsContextEnabled: false,
          selectedDirectConnectionCount: 2,
        }),
      });
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      const menu = result.current.getIntegratedBubbleActionMenuProps('h1', true);
      expect(menu.onConnect).toBeUndefined();
      expect(menu.connectionCount).toBeUndefined();
      expect(menu.onConnectionsClick).toBeUndefined();
      expect(result.current.overlayProps.onConnectionClick).toBeUndefined();
      expect(result.current.getConnectionBadgeCount('h2')).toBeUndefined();
    });

    it('resets editor when switching to slideshow, byAuthor, or non-custom presentation', async () => {
      const options = makeOptions();
      const { result, rerender } = renderHook(
        (props: HookOptions) => useSpaceConnectionIntegration(props),
        { initialProps: options },
      );

      act(() => {
        result.current.editor.startCreate('h1');
      });
      expect(result.current.editor.phase).toBe('pickingTarget');

      rerender({ ...options, viewMode: 'slideshow' });
      await waitFor(() => {
        expect(result.current.editor.phase).toBe('idle');
      });

      act(() => {
        result.current.editor.startCreate('h1');
      });
      rerender({ ...options, layoutMode: 'byAuthor' });
      await waitFor(() => {
        expect(result.current.editor.phase).toBe('idle');
      });

      act(() => {
        result.current.editor.startCreate('h1');
      });
      rerender({ ...options, presentationMode: 'stars' });
      await waitFor(() => {
        expect(result.current.editor.phase).toBe('idle');
      });
    });
  });

  describe('picking target integration', () => {
    it('routes bubble select to chooseTarget while picking', () => {
      const options = makeOptions();
      const { result } = renderHook(() => useSpaceConnectionIntegration(options));

      act(() => {
        result.current.editor.startCreate('h1');
      });
      expect(result.current.isPickingTarget).toBe(true);

      act(() => {
        result.current.handleBubbleSelect('h2');
      });

      expect(result.current.editor.phase).toBe('pickingStrength');
      expect(options.setSelectedBubbleId).not.toHaveBeenCalled();
    });
  });
});
