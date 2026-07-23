import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HossiiConnectionStrength, HossiiConnection } from '../../core/types/hossiiConnection';
import type { Hossii } from '../../core/types';
import type { LayoutMode, ViewMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import type { AppUser } from '../../core/contexts/AuthContext';
import type { Space } from '../../core/types/space';
import type { ActiveSpaceMembershipStatus } from '../../core/utils/membershipJoinController';
import {
  canEditTypeAConnection,
  evaluateTypeAConnectionWriteGate,
} from '../../core/utils/typeAConnectionWriteGate';
import {
  createConnection,
  deleteConnection,
  updateConnectionStrength,
} from '../../core/utils/hossiiConnectionsApi';
import {
  mapCreateConnectionResult,
  mapDeleteConnectionResult,
  mapUpdateConnectionStrengthResult,
} from '../../core/utils/connectionEditorApiAdapters';
import { buildDirectConnectionListItems } from '../../core/utils/connectionVisibility';
import { getHossiiConnectionStrengthLabel } from '../../core/utils/hossiiConnectionStrengthLabels';
import {
  getHossiiBubbleFullText,
  truncateBubbleDisplayText,
  MAX_BUBBLE_TEXT_LENGTH,
} from '../../core/utils/bubbleTextTruncation';
import { useConnectionEditor } from './useConnectionEditor';
import type { ConnectionOverlayInputs } from './useConnectionOverlayInputs';
import type { ConnectionOverlayProps } from './ConnectionOverlay';
import type { ConnectionListPopoverItem } from './ConnectionListPopover';

type BubbleActionMenuBubbleProps = {
  actionMenuEnabled: boolean;
  actionMenuOpen: boolean;
  onActionMenuToggle: () => void;
  onViewDetail?: () => void;
  onConnect?: () => void;
  membershipJoinStatus?: 'joining' | 'error';
  onMembershipRetry?: () => void;
  connectionCount?: number;
  onConnectionsClick?: () => void;
};

type Options = {
  currentUser: AppUser | null | undefined;
  activeSpace: Space | null | undefined;
  isContentArchived: boolean;
  activeSpaceMembershipStatus: ActiveSpaceMembershipStatus;
  retryActiveSpaceMembershipJoin: () => void;
  spaceId: string;
  paneId: string;
  selectedBubbleId: string | null;
  setSelectedBubbleId: (id: string | null) => void;
  setActiveBubbleId: (id: string | null) => void;
  resetBubbleInteraction: () => void;
  closeBubbleActionMenu: () => void;
  getBubbleActionMenuProps: (
    hossiiId: string,
    isThisSelected: boolean,
  ) => BubbleActionMenuBubbleProps;
  overlayInputs: ConnectionOverlayInputs;
  filteredHossiis: Hossii[];
  layoutMode: LayoutMode;
  viewMode: ViewMode;
  presentationMode: PresentationMode;
  contextActivePaneId: string | null | undefined;
};

export function useSpaceConnectionIntegration({
  currentUser,
  activeSpace,
  isContentArchived,
  activeSpaceMembershipStatus,
  retryActiveSpaceMembershipJoin,
  spaceId,
  paneId,
  selectedBubbleId,
  setSelectedBubbleId,
  setActiveBubbleId,
  resetBubbleInteraction,
  closeBubbleActionMenu,
  getBubbleActionMenuProps,
  overlayInputs,
  filteredHossiis,
  layoutMode,
  viewMode,
  presentationMode,
  contextActivePaneId,
}: Options) {
  const typeAWriteGate = useMemo(
    () =>
      evaluateTypeAConnectionWriteGate({
        currentUser,
        activeSpace,
        isContentArchived,
        activeSpaceMembershipStatus,
      }),
    [currentUser, activeSpace, isContentArchived, activeSpaceMembershipStatus],
  );

  const canCreateTypeAConnection = typeAWriteGate.canCreate;

  const canEditConnection = useCallback(
    (connection: HossiiConnection) =>
      canEditTypeAConnection({
        currentUser,
        activeSpace,
        isContentArchived,
        connection,
      }),
    [currentUser, activeSpace, isContentArchived],
  );

  const {
    overlayProps: baseOverlayProps,
    selectedDirectConnectionCount,
    refetch,
    isConnectionsContextEnabled,
    connectionBadgeCountByHossiiId,
  } = overlayInputs;

  const editorCallbacks = useMemo(
    () => ({
      onCreate: async (input: {
        sourceHossiiId: string;
        targetHossiiId: string;
        strength: HossiiConnectionStrength;
      }) => {
        const result = mapCreateConnectionResult(
          await createConnection({
            spaceId,
            paneId,
            ...input,
          }),
        );
        if (result.ok) refetch();
        return result;
      },
      onUpdateStrength: async (input: {
        connectionId: string;
        strength: HossiiConnectionStrength;
      }) => {
        const result = mapUpdateConnectionStrengthResult(
          await updateConnectionStrength(input.connectionId, input.strength),
        );
        if (result.ok) refetch();
        return result;
      },
      onDelete: async (input: { connectionId: string }) => {
        const result = mapDeleteConnectionResult(
          await deleteConnection(input.connectionId),
        );
        if (result.ok) refetch();
        return result;
      },
    }),
    [spaceId, paneId, refetch],
  );

  const editor = useConnectionEditor(editorCallbacks);
  const [connectionListOpen, setConnectionListOpen] = useState(false);

  const closeConnectionList = useCallback(() => {
    setConnectionListOpen(false);
  }, []);

  const visibleHossiiIds = useMemo(
    () => new Set(filteredHossiis.map((h) => h.id)),
    [filteredHossiis],
  );

  const hossiiById = useMemo(
    () => new Map(filteredHossiis.map((h) => [h.id, h])),
    [filteredHossiis],
  );

  const connectionListItems: ConnectionListPopoverItem[] = useMemo(() => {
    if (!isConnectionsContextEnabled || !selectedBubbleId) return [];
    return buildDirectConnectionListItems({
      connections: overlayInputs.connections,
      selectedBubbleId,
      activePaneId: paneId,
      visibleHossiiIds,
    })
      .map((item) => {
        const peer = hossiiById.get(item.peerHossiiId);
        const fullText = peer ? getHossiiBubbleFullText(peer) : '';
        return {
          connectionId: item.connectionId,
          peerHossiiId: item.peerHossiiId,
          messagePreview: truncateBubbleDisplayText(fullText, MAX_BUBBLE_TEXT_LENGTH) || '（本文なし）',
          strengthLabel: getHossiiConnectionStrengthLabel(item.strength).title,
        };
      });
  }, [
    isConnectionsContextEnabled,
    selectedBubbleId,
    overlayInputs.connections,
    paneId,
    visibleHossiiIds,
    hossiiById,
  ]);

  const editorReset = editor.reset;
  const isEditorSaving = editor.isSaving || editor.phase === 'saving';

  const resetConnectionState = useCallback(() => {
    if (isEditorSaving) return;
    closeConnectionList();
    editorReset();
    resetBubbleInteraction();
  }, [isEditorSaving, closeConnectionList, editorReset, resetBubbleInteraction]);

  const shouldAllowBubbleReset = useCallback(() => !isEditorSaving, [isEditorSaving]);

  const handleEscapeReset = useCallback(() => {
    if (isEditorSaving) return;
    if (connectionListOpen) {
      closeConnectionList();
      return;
    }
    if (editor.phase === 'error' || editor.phase !== 'idle') {
      editorReset();
      return;
    }
    resetBubbleInteraction();
  }, [
    isEditorSaving,
    connectionListOpen,
    closeConnectionList,
    editor.phase,
    editorReset,
    resetBubbleInteraction,
  ]);

  useEffect(() => {
    if (!connectionListOpen) return;
    if (!isConnectionsContextEnabled || !selectedBubbleId || connectionListItems.length === 0) {
      queueMicrotask(() => closeConnectionList());
    }
  }, [
    connectionListOpen,
    isConnectionsContextEnabled,
    selectedBubbleId,
    connectionListItems.length,
    closeConnectionList,
  ]);

  useEffect(() => {
    queueMicrotask(() => closeConnectionList());
  }, [contextActivePaneId, presentationMode, layoutMode, viewMode, closeConnectionList]);

  useEffect(() => {
    if (!selectedBubbleId && editor.phase !== 'idle' && editor.phase !== 'error') {
      if (isEditorSaving) return;
      queueMicrotask(() => editorReset());
    }
  }, [selectedBubbleId, editor.phase, editorReset, isEditorSaving]);

  const prevPaneIdRef = useRef(contextActivePaneId);
  const prevPresentationModeRef = useRef(presentationMode);
  const prevLayoutModeRef = useRef(layoutMode);
  const prevViewModeRef = useRef(viewMode);

  useEffect(() => {
    const prev = prevPaneIdRef.current;
    if (prev != null && contextActivePaneId != null && prev !== contextActivePaneId) {
      if (!isEditorSaving) queueMicrotask(() => editorReset());
    }
    prevPaneIdRef.current = contextActivePaneId;
  }, [contextActivePaneId, editorReset, isEditorSaving]);

  useEffect(() => {
    if (prevLayoutModeRef.current !== layoutMode && layoutMode === 'byAuthor') {
      if (!isEditorSaving) queueMicrotask(() => editorReset());
    }
    prevLayoutModeRef.current = layoutMode;
  }, [layoutMode, editorReset, isEditorSaving]);

  useEffect(() => {
    if (prevViewModeRef.current !== viewMode && viewMode === 'slideshow') {
      if (!isEditorSaving) queueMicrotask(() => editorReset());
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, editorReset, isEditorSaving]);

  useEffect(() => {
    if (prevPresentationModeRef.current !== presentationMode) {
      if (!isEditorSaving) queueMicrotask(() => editorReset());
    }
    prevPresentationModeRef.current = presentationMode;
  }, [presentationMode, editorReset, isEditorSaving]);

  const handleBubbleSelect = useCallback(
    (id: string) => {
      if (isEditorSaving) return;

      if (editor.phase === 'pickingTarget') {
        editor.chooseTarget(id);
        return;
      }

      if (editor.phase === 'error') {
        editorReset();
      } else if (editor.phase !== 'idle') {
        return;
      }

      setSelectedBubbleId(id);
      setActiveBubbleId(null);
      closeBubbleActionMenu();
    },
    [
      isEditorSaving,
      editor,
      editorReset,
      setSelectedBubbleId,
      setActiveBubbleId,
      closeBubbleActionMenu,
    ],
  );

  const handleConnectFromMenu = useCallback(() => {
    if (!isConnectionsContextEnabled || !canCreateTypeAConnection || !selectedBubbleId) return;
    closeBubbleActionMenu();
    editor.startCreate(selectedBubbleId);
  }, [
    isConnectionsContextEnabled,
    canCreateTypeAConnection,
    selectedBubbleId,
    editor,
    closeBubbleActionMenu,
  ]);

  const handleConnectionOverlayClick = useCallback(
    (connection: HossiiConnection) => {
      if (!isConnectionsContextEnabled || !canEditConnection(connection)) return;
      editor.startEdit(connection);
    },
    [isConnectionsContextEnabled, canEditConnection, editor],
  );

  const openConnectionList = useCallback(() => {
    if (!isConnectionsContextEnabled || selectedDirectConnectionCount <= 0) return;
    closeBubbleActionMenu();
    setConnectionListOpen(true);
  }, [
    isConnectionsContextEnabled,
    selectedDirectConnectionCount,
    closeBubbleActionMenu,
  ]);

  const handleConnectionListSelect = useCallback(
    (peerHossiiId: string) => {
      if (isEditorSaving) return;
      closeConnectionList();
      if (editor.phase === 'error' || editor.phase !== 'idle') {
        editorReset();
      }
      setSelectedBubbleId(peerHossiiId);
      setActiveBubbleId(null);
    },
    [
      isEditorSaving,
      closeConnectionList,
      editor.phase,
      editorReset,
      setSelectedBubbleId,
      setActiveBubbleId,
    ],
  );

  const getIntegratedBubbleActionMenuProps = useCallback(
    (hossiiId: string, isThisSelected: boolean): BubbleActionMenuBubbleProps => {
      const base = getBubbleActionMenuProps(hossiiId, isThisSelected);
      if (!isThisSelected) return base;

      const showConnectionMenuItems = isConnectionsContextEnabled;

      const membershipJoinStatus =
        typeAWriteGate.blockReason === 'membership_joining'
          ? ('joining' as const)
          : typeAWriteGate.blockReason === 'membership_error'
            ? ('error' as const)
            : undefined;

      return {
        ...base,
        onConnect:
          isConnectionsContextEnabled && canCreateTypeAConnection
            ? handleConnectFromMenu
            : undefined,
        membershipJoinStatus:
          isConnectionsContextEnabled && membershipJoinStatus ? membershipJoinStatus : undefined,
        onMembershipRetry:
          isConnectionsContextEnabled && membershipJoinStatus === 'error'
            ? retryActiveSpaceMembershipJoin
            : undefined,
        connectionCount:
          showConnectionMenuItems && selectedDirectConnectionCount > 0
            ? selectedDirectConnectionCount
            : undefined,
        onConnectionsClick:
          showConnectionMenuItems && selectedDirectConnectionCount > 0
            ? openConnectionList
            : undefined,
      };
    },
    [
      getBubbleActionMenuProps,
      isConnectionsContextEnabled,
      canCreateTypeAConnection,
      typeAWriteGate.blockReason,
      handleConnectFromMenu,
      retryActiveSpaceMembershipJoin,
      selectedDirectConnectionCount,
      openConnectionList,
    ],
  );

  const getConnectionBadgeCount = useCallback(
    (hossiiId: string): number | undefined => {
      if (!isConnectionsContextEnabled) return undefined;
      if (selectedBubbleId === hossiiId) return undefined;
      const count = connectionBadgeCountByHossiiId.get(hossiiId) ?? 0;
      return count > 0 ? count : undefined;
    },
    [isConnectionsContextEnabled, selectedBubbleId, connectionBadgeCountByHossiiId],
  );

  const canUseConnectionEditor =
    canCreateTypeAConnection ||
    (editor.editingConnection != null && canEditConnection(editor.editingConnection));

  const overlayProps: ConnectionOverlayProps = useMemo(
    () => ({
      ...baseOverlayProps,
      onConnectionClick: isConnectionsContextEnabled ? handleConnectionOverlayClick : undefined,
    }),
    [baseOverlayProps, isConnectionsContextEnabled, handleConnectionOverlayClick],
  );

  const isPickingTarget = editor.phase === 'pickingTarget';

  return {
    overlayProps,
    editor,
    canCreateTypeAConnection,
    canEditConnection,
    canUseConnectionEditor,
    typeAWriteGate,
    isConnectionsContextEnabled,
    resetConnectionState,
    shouldAllowBubbleReset,
    handleEscapeReset,
    handleBubbleSelect,
    handleBubbleDeselect: resetConnectionState,
    getIntegratedBubbleActionMenuProps,
    getConnectionBadgeCount,
    isPickingTarget,
    connectionListOpen,
    connectionListItems,
    handleConnectionListSelect,
  };
}
