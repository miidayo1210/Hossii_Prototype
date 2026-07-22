import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hossii } from '../../core/types';
import type { LayoutMode, ViewMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';

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
  isMobile: boolean;
  presentationMode: PresentationMode;
  layoutMode: LayoutMode;
  viewMode: ViewMode;
  isContentArchived: boolean;
  selectedBubbleId: string | null;
  setSelectedBubbleId: (id: string | null) => void;
  setActiveBubbleId: (id: string | null) => void;
  setSelectedPostId: (id: string | null) => void;
  filteredHossiis: Hossii[];
  contextActivePaneId: string | null | undefined;
};

export function useCustomBubbleActionMenu({
  isMobile,
  presentationMode,
  layoutMode,
  viewMode,
  isContentArchived,
  selectedBubbleId,
  setSelectedBubbleId,
  setActiveBubbleId,
  setSelectedPostId,
  filteredHossiis,
  contextActivePaneId,
}: Options) {
  const [bubbleActionMenuOpen, setBubbleActionMenuOpen] = useState(false);
  const prevPaneIdRef = useRef(contextActivePaneId);
  const prevPresentationModeRef = useRef(presentationMode);
  const prevLayoutModeRef = useRef(layoutMode);
  const prevViewModeRef = useRef(viewMode);

  const closeBubbleActionMenu = useCallback(() => {
    setBubbleActionMenuOpen(false);
  }, []);

  const bubbleActionMenuEnabled =
    !isMobile &&
    presentationMode === 'custom' &&
    (layoutMode === 'random' || layoutMode === 'ordered');

  const resetBubbleInteraction = useCallback(() => {
    setSelectedBubbleId(null);
    setActiveBubbleId(null);
    setBubbleActionMenuOpen(false);
  }, [setSelectedBubbleId, setActiveBubbleId]);

  const handleBubbleSelect = useCallback(
    (id: string) => {
      setSelectedBubbleId(id);
      setBubbleActionMenuOpen(false);
    },
    [setSelectedBubbleId],
  );

  const handleBubbleDeselect = resetBubbleInteraction;

  const handleBubbleActionMenuToggle = useCallback(() => {
    setBubbleActionMenuOpen((open) => !open);
  }, []);

  const handleBubbleViewDetail = useCallback(
    (id: string) => {
      setSelectedPostId(id);
      setBubbleActionMenuOpen(false);
    },
    [setSelectedPostId],
  );

  const handleBubbleConnectStub = useCallback(() => {
    // wired by useSpaceConnectionIntegration
  }, []);

  const handleBubbleConnectionsClick = useCallback(() => {
    closeBubbleActionMenu();
  }, [closeBubbleActionMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetBubbleInteraction();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [resetBubbleInteraction]);

  useEffect(() => {
    if (!isContentArchived) return;
    queueMicrotask(() => resetBubbleInteraction());
  }, [isContentArchived, resetBubbleInteraction]);

  useEffect(() => {
    const prev = prevPaneIdRef.current;
    if (prev != null && contextActivePaneId != null && prev !== contextActivePaneId) {
      queueMicrotask(() => resetBubbleInteraction());
    }
    prevPaneIdRef.current = contextActivePaneId;
  }, [contextActivePaneId, resetBubbleInteraction]);

  useEffect(() => {
    if (prevPresentationModeRef.current === presentationMode) return;
    queueMicrotask(() => resetBubbleInteraction());
    prevPresentationModeRef.current = presentationMode;
  }, [presentationMode, resetBubbleInteraction]);

  useEffect(() => {
    if (prevLayoutModeRef.current !== layoutMode && layoutMode === 'byAuthor') {
      queueMicrotask(() => resetBubbleInteraction());
    }
    prevLayoutModeRef.current = layoutMode;
  }, [layoutMode, resetBubbleInteraction]);

  useEffect(() => {
    if (prevViewModeRef.current !== viewMode && viewMode === 'slideshow') {
      queueMicrotask(() => resetBubbleInteraction());
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, resetBubbleInteraction]);

  useEffect(() => {
    if (!selectedBubbleId) return;
    if (!filteredHossiis.some((h) => h.id === selectedBubbleId)) {
      queueMicrotask(() => resetBubbleInteraction());
    }
  }, [filteredHossiis, resetBubbleInteraction, selectedBubbleId]);

  const getBubbleActionMenuProps = useCallback(
    (hossiiId: string, isThisSelected: boolean): BubbleActionMenuBubbleProps => ({
      actionMenuEnabled: bubbleActionMenuEnabled,
      actionMenuOpen: bubbleActionMenuOpen && isThisSelected,
      onActionMenuToggle: handleBubbleActionMenuToggle,
      onViewDetail: () => handleBubbleViewDetail(hossiiId),
      onConnect:
        bubbleActionMenuEnabled && !isContentArchived
          ? handleBubbleConnectStub
          : undefined,
      connectionCount: undefined,
      onConnectionsClick: bubbleActionMenuEnabled
        ? handleBubbleConnectionsClick
        : undefined,
    }),
    [
      bubbleActionMenuEnabled,
      bubbleActionMenuOpen,
      handleBubbleActionMenuToggle,
      handleBubbleViewDetail,
      handleBubbleConnectStub,
      handleBubbleConnectionsClick,
      isContentArchived,
    ],
  );

  return {
    resetBubbleInteraction,
    closeBubbleActionMenu,
    handleBubbleSelect,
    handleBubbleDeselect,
    getBubbleActionMenuProps,
  };
}
