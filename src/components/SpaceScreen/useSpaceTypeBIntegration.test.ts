// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AppUser } from '../../core/contexts/AuthContext';
import type { Hossii } from '../../core/types';
import type { Space } from '../../core/types/space';
import { useTypeBEditor } from './useTypeBEditor';
import {
  evaluateTypeBSubmitGate,
  formatTypeBSubmitErrorMessage,
  useSpaceTypeBIntegration,
} from './useSpaceTypeBIntegration';
import { TYPE_B_EDITOR_PROMPT } from './typeBEditorTypes';
import { createTypeBConnectedHossii } from '../../core/utils/typeBCreateApi';
import { computeTypeBNearOriginPlacement } from '../../core/utils/typeBNearOriginPlacement';
import { refetchSpaceHossiisAfterMutation } from '../../core/utils/refetchSpaceHossiisAfterMutation';

vi.mock('../../core/utils/typeBCreateApi', () => ({
  createTypeBConnectedHossii: vi.fn(),
  TYPE_B_MESSAGE_MAX_LENGTH: 200,
}));

vi.mock('../../core/utils/typeBNearOriginPlacement', () => ({
  computeTypeBNearOriginPlacement: vi.fn(),
}));

vi.mock('../../core/utils/refetchSpaceHossiisAfterMutation', () => ({
  refetchSpaceHossiisAfterMutation: vi.fn(),
}));

const mockedCreate = vi.mocked(createTypeBConnectedHossii);
const mockedPlacement = vi.mocked(computeTypeBNearOriginPlacement);
const mockedRefetchHossiis = vi.mocked(refetchSpaceHossiisAfterMutation);

function makeHossii(id: string, overrides: Partial<Hossii> = {}): Hossii {
  return {
    id,
    message: 'msg',
    authorName: 'author',
    createdAt: new Date('2026-07-01'),
    visibility: 'public',
    positionX: 30,
    positionY: 40,
    ...overrides,
  } as Hossii;
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

function makeSpace(): Space {
  return {
    id: 'space-1',
    name: 'Test Space',
    communityId: 'comm-1',
  } as Space;
}

type IntegrationOptions = Omit<Parameters<typeof useSpaceTypeBIntegration>[0], 'editor'>;

function makeIntegrationOptions(
  overrides: Partial<IntegrationOptions> = {},
): IntegrationOptions {
  const setSelectedBubbleId = vi.fn();
  const refetchConnections = vi.fn();
  const syncFetchedHossiis = vi.fn();
  const onPostPanelOpen = vi.fn();
  const onPostPanelClose = vi.fn();

  return {
    typeAEditorPhase: 'idle',
    currentUser: makeAdminUser(),
    activeSpace: makeSpace(),
    isContentArchived: false,
    activeSpaceMembershipStatus: 'active',
    spaceId: 'space-1',
    paneId: 'pane-1',
    selectedBubbleId: 'origin-1',
    setSelectedBubbleId,
    filteredHossiis: [makeHossii('origin-1'), makeHossii('other-1', { positionX: 60, positionY: 70 })],
    isConnectionsContextEnabled: true,
    refetchConnections,
    syncFetchedHossiis,
    screenQueryKey: 'query-1',
    displayPeriod: 'all',
    paneContext: null,
    getExistingHossiis: () => [],
    bubbleAreaRef: { current: null },
    contextActivePaneId: 'pane-1',
    presentationMode: 'custom',
    viewMode: 'full',
    layoutMode: 'random',
    onPostPanelOpen,
    onPostPanelClose,
    ...overrides,
  };
}

function renderIntegration(overrides: Partial<IntegrationOptions> = {}) {
  let currentOptions = makeIntegrationOptions(overrides);

  const hook = renderHook(
    (props: IntegrationOptions) => {
      const editor = useTypeBEditor();
      const integration = useSpaceTypeBIntegration({ editor, ...props });
      return { editor, integration };
    },
    { initialProps: currentOptions },
  );

  return {
    hook,
    options: currentOptions,
    setSelectedBubbleId: currentOptions.setSelectedBubbleId,
    refetchConnections: currentOptions.refetchConnections,
    syncFetchedHossiis: currentOptions.syncFetchedHossiis,
    onPostPanelOpen: currentOptions.onPostPanelOpen,
    onPostPanelClose: currentOptions.onPostPanelClose,
    rerender: (nextOverrides: Partial<IntegrationOptions>) => {
      currentOptions = { ...currentOptions, ...nextOverrides };
      hook.rerender(currentOptions);
    },
  };
}

describe('useSpaceTypeBIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlacement.mockReturnValue({ positionX: 44, positionY: 52 });
    mockedRefetchHossiis.mockResolvedValue([makeHossii('new-1')]);
    mockedCreate.mockResolvedValue({
      ok: true,
      result: {
        newHossiiId: 'new-1',
        connectionId: 'conn-1',
        originHossiiId: 'origin-1',
        idempotentReplay: false,
      },
    });
  });

  it('startFromOrigin uses placement util and opens post panel', () => {
    const { hook, onPostPanelOpen } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    expect(mockedPlacement).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { x: 30, y: 40 },
        seed: 'origin-1',
      }),
    );
    expect(hook.result.current.editor.originHossiiId).toBe('origin-1');
    expect(onPostPanelOpen).toHaveBeenCalled();
    expect(hook.result.current.integration.postScreenTypeBMode?.prompt).toBe(TYPE_B_EDITOR_PROMPT);
  });

  it('calls createTypeBConnectedHossii once with RPC args on submit success', async () => {
    const { hook, setSelectedBubbleId, refetchConnections, syncFetchedHossiis } =
      renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    const { idempotencyKey, newHossiiId } = hook.result.current.editor;

    act(() => {
      hook.result.current.editor.setDraftMessage('広がった内容');
    });

    await act(async () => {
      await hook.result.current.integration.handleSubmit();
    });

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey,
        newHossiiId,
        originHossiiId: 'origin-1',
        spaceId: 'space-1',
        paneId: 'pane-1',
        message: '広がった内容',
        positionX: 44,
        positionY: 52,
      }),
    );
    expect(refetchConnections).toHaveBeenCalledTimes(1);
    expect(syncFetchedHossiis).toHaveBeenCalled();
    expect(setSelectedBubbleId).toHaveBeenCalledWith('new-1');
    expect(hook.result.current.editor.phase).toBe('idle');
  });

  it('reuses same keys on retry after failure', async () => {
    mockedCreate
      .mockResolvedValueOnce({
        ok: false,
        message: 'temporary',
      })
      .mockResolvedValueOnce({
        ok: true,
        result: {
          newHossiiId: 'new-1',
          connectionId: 'conn-1',
          originHossiiId: 'origin-1',
          idempotentReplay: true,
        },
      });

    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    const { idempotencyKey, newHossiiId } = hook.result.current.editor;

    act(() => {
      hook.result.current.editor.setDraftMessage('retry message');
    });

    await act(async () => {
      await hook.result.current.integration.handleSubmit();
    });
    await act(async () => {
      await hook.result.current.integration.handleSubmit();
    });

    expect(mockedCreate).toHaveBeenCalledTimes(2);
    expect(mockedCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ idempotencyKey, newHossiiId }),
    );
  });

  it('keeps draft on failure and exposes RPC_NOT_AVAILABLE message', async () => {
    mockedCreate.mockResolvedValue({
      ok: false,
      message: 'create_type_b_connected_hossii RPC is not available',
      code: 'RPC_NOT_AVAILABLE',
    });

    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
      hook.result.current.editor.setDraftMessage('keep me');
    });

    await act(async () => {
      await hook.result.current.integration.handleSubmit();
    });

    expect(hook.result.current.editor.phase).toBe('error');
    expect(hook.result.current.editor.draftMessage).toBe('keep me');
    expect(hook.result.current.integration.postScreenTypeBMode?.errorMessage).toContain(
      'RPC_NOT_AVAILABLE',
    );
  });

  it('prevents double submit', async () => {
    mockedCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                result: {
                  newHossiiId: 'new-1',
                  connectionId: 'conn-1',
                  originHossiiId: 'origin-1',
                  idempotentReplay: false,
                },
              }),
            50,
          );
        }),
    );

    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
      hook.result.current.editor.setDraftMessage('msg');
      hook.result.current.editor.beginSubmit();
    });

    await act(async () => {
      await Promise.all([
        hook.result.current.integration.handleSubmit(),
        hook.result.current.integration.handleSubmit(),
      ]);
    });

    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('cancel clears editor and provisional thread', () => {
    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
      hook.result.current.integration.handleCancel();
    });

    expect(hook.result.current.editor.phase).toBe('idle');
    expect(hook.result.current.integration.provisionalThread).toBeNull();
  });

  it('blocks start when Type A editor is active', () => {
    const { hook, onPostPanelOpen } = renderIntegration({ typeAEditorPhase: 'pickingTarget' });

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    expect(hook.result.current.editor.phase).toBe('idle');
    expect(onPostPanelOpen).not.toHaveBeenCalled();
  });

  it('shows provisional thread only while composing', () => {
    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    expect(hook.result.current.integration.provisionalThread).toEqual({
      originHossiiId: 'origin-1',
      positionX: 44,
      positionY: 52,
    });

    act(() => {
      hook.result.current.editor.beginSubmit();
    });

    expect(hook.result.current.integration.provisionalThread).toBeNull();
  });

  it('ignores cancel while submitting', () => {
    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    act(() => {
      hook.result.current.editor.beginSubmit();
    });

    act(() => {
      hook.result.current.integration.handleCancel();
    });

    expect(hook.result.current.editor.phase).toBe('submitting');
  });

  it('blocks reset while submitting', () => {
    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    act(() => {
      hook.result.current.editor.beginSubmit();
    });

    expect(hook.result.current.integration.resetIfAllowed()).toBe(false);
    expect(hook.result.current.editor.phase).toBe('submitting');
  });

  it('disables close while submitting', () => {
    const { hook } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    act(() => {
      hook.result.current.editor.beginSubmit();
    });

    expect(hook.result.current.integration.postScreenTypeBMode?.closeDisabled).toBe(true);
  });

  it('skips RPC when submit gate fails and keeps retry ids', async () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
      hook.result.current.editor.setDraftMessage('retry me');
    });

    const { idempotencyKey, newHossiiId } = hook.result.current.editor;

    rerender({ isConnectionsContextEnabled: false });

    await act(async () => {
      await hook.result.current.integration.handleSubmit();
    });

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(hook.result.current.editor.phase).toBe('error');
    expect(hook.result.current.editor.idempotencyKey).toBe(idempotencyKey);
    expect(hook.result.current.editor.newHossiiId).toBe(newHossiiId);
    expect(hook.result.current.editor.draftMessage).toBe('retry me');
  });

  it('cleans up on pane change', () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });
    expect(hook.result.current.editor.phase).toBe('composing');

    rerender({ contextActivePaneId: 'pane-2' });

    expect(hook.result.current.editor.phase).toBe('idle');
    expect(hook.result.current.integration.provisionalThread).toBeNull();
  });

  it('cleans up on presentation mode change', () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    rerender({ presentationMode: 'stars' });

    expect(hook.result.current.editor.phase).toBe('idle');
  });

  it('cleans up on viewMode slideshow change', () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    rerender({ viewMode: 'slideshow' });

    expect(hook.result.current.editor.phase).toBe('idle');
  });

  it('cleans up on layout byAuthor change', () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    rerender({ layoutMode: 'byAuthor' });

    expect(hook.result.current.editor.phase).toBe('idle');
  });

  it('cleans up when origin bubble is filtered out', () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    rerender({
      filteredHossiis: [makeHossii('other-1', { positionX: 60, positionY: 70 })],
    });

    expect(hook.result.current.editor.phase).toBe('idle');
  });

  it('cleans up on bubble deselect', () => {
    const { hook, rerender } = renderIntegration();

    act(() => {
      hook.result.current.integration.startFromOrigin('origin-1');
    });

    rerender({ selectedBubbleId: null });

    expect(hook.result.current.editor.phase).toBe('idle');
  });
});

describe('evaluateTypeBSubmitGate', () => {
  it('returns null when all checks pass', () => {
    expect(
      evaluateTypeBSubmitGate({
        isConnectionsContextEnabled: true,
        writeGate: { canCreate: true, blockReason: null, bypassesMembership: true },
        originHossiiId: 'origin-1',
        originExists: true,
      }),
    ).toBeNull();
  });

  it('blocks when connections context is disabled', () => {
    expect(
      evaluateTypeBSubmitGate({
        isConnectionsContextEnabled: false,
        writeGate: { canCreate: true, blockReason: null, bypassesMembership: true },
        originHossiiId: 'origin-1',
        originExists: true,
      }),
    ).toContain('つなげて作れません');
  });

  it('blocks when origin is missing', () => {
    expect(
      evaluateTypeBSubmitGate({
        isConnectionsContextEnabled: true,
        writeGate: { canCreate: true, blockReason: null, bypassesMembership: true },
        originHossiiId: 'origin-1',
        originExists: false,
      }),
    ).toContain('起点');
  });
});

describe('formatTypeBSubmitErrorMessage', () => {
  it('appends RPC_NOT_AVAILABLE suffix', () => {
    expect(
      formatTypeBSubmitErrorMessage({
        message: 'create_type_b_connected_hossii RPC is not available',
        code: 'RPC_NOT_AVAILABLE',
      }),
    ).toContain('RPC_NOT_AVAILABLE');
  });
});
