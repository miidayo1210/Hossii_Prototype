import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { HossiiConnectionStrength } from '../../core/types/hossiiConnection';
import type { LayoutMode, ViewMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import { canManageSpace } from '../../core/utils/spaceAdminAccess';
import type { AppUser } from '../../core/contexts/AuthContext';
import type { Space } from '../../core/types/space';
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
import { useConnectionEditor } from './useConnectionEditor';
import type { ConnectionOverlayInputs } from './useConnectionOverlayInputs';
import type { ConnectionOverlayProps } from './ConnectionOverlay';

type BubbleActionMenuBubbleProps = {
  actionMenuEnabled: boolean;
  actionMenuOpen: boolean;
  onActionMenuToggle: () => void;
  onViewDetail?: () => void;
  onConnect?: () => void;
  connectionCount?: number;
  onConnectionsClick?: () => void;
};

type Options = {
  currentUser: AppUser | null | undefined;
  activeSpace: Space | null | undefined;
  isContentArchived: boolean;
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
  layoutMode: LayoutMode;
  viewMode: ViewMode;
  presentationMode: PresentationMode;
  contextActivePaneId: string | null | undefined;
};

export function useSpaceConnectionIntegration({
  currentUser,
  activeSpace,
  isContentArchived,
  spaceId,
  paneId,
  selectedBubbleId,
  setSelectedBubbleId,
  setActiveBubbleId,
  resetBubbleInteraction,
  closeBubbleActionMenu,
  getBubbleActionMenuProps,
  overlayInputs,
  layoutMode,
  viewMode,
  presentationMode,
  contextActivePaneId,
}: Options) {
  const canWriteConnections =
    !isContentArchived && canManageSpace(currentUser, activeSpace);

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

  const editorReset = editor.reset;
  const isEditorSaving = editor.isSaving || editor.phase === 'saving';

  const resetConnectionState = useCallback(() => {
    if (isEditorSaving) return;
    editorReset();
    resetBubbleInteraction();
  }, [isEditorSaving, editorReset, resetBubbleInteraction]);

  const shouldAllowBubbleReset = useCallback(() => !isEditorSaving, [isEditorSaving]);

  const handleEscapeReset = useCallback(() => {
    if (isEditorSaving) return;
    if (editor.phase === 'error' || editor.phase !== 'idle') {
      editorReset();
      return;
    }
    resetBubbleInteraction();
  }, [isEditorSaving, editor.phase, editorReset, resetBubbleInteraction]);

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
    if (!isConnectionsContextEnabled || !canWriteConnections || !selectedBubbleId) return;
    closeBubbleActionMenu();
    editor.startCreate(selectedBubbleId);
  }, [
    isConnectionsContextEnabled,
    canWriteConnections,
    selectedBubbleId,
    editor,
    closeBubbleActionMenu,
  ]);

  const getIntegratedBubbleActionMenuProps = useCallback(
    (hossiiId: string, isThisSelected: boolean): BubbleActionMenuBubbleProps => {
      const base = getBubbleActionMenuProps(hossiiId, isThisSelected);
      if (!isThisSelected) return base;

      const showConnectionMenuItems = isConnectionsContextEnabled;

      return {
        ...base,
        onConnect:
          isConnectionsContextEnabled && canWriteConnections
            ? handleConnectFromMenu
            : undefined,
        connectionCount:
          showConnectionMenuItems && selectedDirectConnectionCount > 0
            ? selectedDirectConnectionCount
            : undefined,
        onConnectionsClick:
          showConnectionMenuItems && selectedDirectConnectionCount > 0
            ? base.onConnectionsClick
            : undefined,
      };
    },
    [
      getBubbleActionMenuProps,
      isConnectionsContextEnabled,
      canWriteConnections,
      handleConnectFromMenu,
      selectedDirectConnectionCount,
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

  const overlayProps: ConnectionOverlayProps = useMemo(
    () => ({
      ...baseOverlayProps,
      onConnectionClick:
        isConnectionsContextEnabled && canWriteConnections
          ? editor.startEdit
          : undefined,
    }),
    [baseOverlayProps, isConnectionsContextEnabled, canWriteConnections, editor.startEdit],
  );

  const isPickingTarget = editor.phase === 'pickingTarget';

  return {
    overlayProps,
    editor,
    canWriteConnections,
    isConnectionsContextEnabled,
    resetConnectionState,
    shouldAllowBubbleReset,
    handleEscapeReset,
    handleBubbleSelect,
    handleBubbleDeselect: resetConnectionState,
    getIntegratedBubbleActionMenuProps,
    getConnectionBadgeCount,
    isPickingTarget,
  };
}
