import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import {
  buildDirectPeerTwoHopStarCounts,
  getDirectPeerHossiiIds,
  countVisibleTwoHopPeers,
} from '../../core/utils/connectionVisibility';
import { useConnectionPullInteraction } from '../../core/hooks/useConnectionPullInteraction';
import { usePrefersReducedMotion } from '../../core/hooks/usePrefersReducedMotion';
import {
  applyConnectionTwoHopStars,
  clearConnectionTwoHopStarsFromElements,
} from '../../core/utils/connectionTwoHopStars';
import type { ConnectionEditorPhase } from './connectionEditorTypes';


type BubbleInteractionLock = {
  isDragging: boolean;
  isResizing: boolean;
};

type Options = {
  bubbleAreaRef: RefObject<HTMLElement | null>;
  connections: HossiiConnection[];
  selectedBubbleId: string | null;
  activePaneId: string;
  visibleHossiiIds: ReadonlySet<string>;
  isConnectionsContextEnabled: boolean;
  editorPhase: ConnectionEditorPhase;
  typeBEditorActive?: boolean;
  bubbleInteractionLock: BubbleInteractionLock;
};

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findBubbleElement(root: HTMLElement, hossiiId: string): HTMLElement | null {
  return root.querySelector(`[data-hossii-id="${escapeSelectorValue(hossiiId)}"]`);
}

const EDITOR_PHASES_BLOCKING_PULL = new Set<ConnectionEditorPhase>([
  'pickingTarget',
  'pickingStrength',
  'saving',
  'editing',
  'deleting',
  'error',
]);

export function useSpaceConnectionPull({
  bubbleAreaRef,
  connections,
  selectedBubbleId,
  activePaneId,
  visibleHossiiIds,
  isConnectionsContextEnabled,
  editorPhase,
  typeBEditorActive = false,
  bubbleInteractionLock,
}: Options) {
  const sourceRef = useRef<HTMLElement | null>(null);
  const connectedElementsRef = useRef<readonly HTMLElement[]>([]);
  const suppressClickAfterPullRef = useRef(false);
  const wasPullingRef = useRef(false);

  const directPeerIds = useMemo(() => {
    if (!selectedBubbleId || !isConnectionsContextEnabled) return [];
    return getDirectPeerHossiiIds({
      connections,
      selectedBubbleId,
      activePaneId,
      visibleHossiiIds,
    });
  }, [
    connections,
    selectedBubbleId,
    activePaneId,
    visibleHossiiIds,
    isConnectionsContextEnabled,
  ]);

  const twoHopPeerCount = useMemo(() => {
    if (!selectedBubbleId || !isConnectionsContextEnabled) return 0;
    return countVisibleTwoHopPeers({
      connections,
      selectedBubbleId,
      activePaneId,
      visibleHossiiIds,
    });
  }, [
    connections,
    selectedBubbleId,
    activePaneId,
    visibleHossiiIds,
    isConnectionsContextEnabled,
  ]);

  const pullEnabled =
    isConnectionsContextEnabled &&
    selectedBubbleId != null &&
    directPeerIds.length > 0 &&
    !typeBEditorActive &&
    !EDITOR_PHASES_BLOCKING_PULL.has(editorPhase) &&
    !bubbleInteractionLock.isDragging &&
    !bubbleInteractionLock.isResizing;


  const visibleConnectionFilter = useMemo(() => {
    if (!selectedBubbleId) return null;
    return {
      connections,
      selectedBubbleId,
      activePaneId,
      visibleHossiiIds,
    };
  }, [connections, selectedBubbleId, activePaneId, visibleHossiiIds]);

  const peerTwoHopStarCounts = useMemo(() => {
    if (!visibleConnectionFilter) return new Map<string, 1 | 2 | 3>();
    return buildDirectPeerTwoHopStarCounts(visibleConnectionFilter, directPeerIds);
  }, [visibleConnectionFilter, directPeerIds]);

  const prefersReducedMotion = usePrefersReducedMotion();
  const markedPeerElementsRef = useRef<HTMLElement[]>([]);

  const pullHandleVisible =
    isConnectionsContextEnabled && directPeerIds.length > 0 && !typeBEditorActive;


  const clearPeerTwoHopStars = useCallback(() => {
    clearConnectionTwoHopStarsFromElements(markedPeerElementsRef.current);
    markedPeerElementsRef.current = [];
  }, []);

  const applyPeerTwoHopStars = useCallback(() => {
    const area = bubbleAreaRef.current;
    if (!area) return;

    clearPeerTwoHopStars();
    const marked: HTMLElement[] = [];
    for (const peerId of directPeerIds) {
      const count = peerTwoHopStarCounts.get(peerId);
      if (!count) continue;
      const element = findBubbleElement(area, peerId);
      if (!element) continue;
      applyConnectionTwoHopStars(element, count, prefersReducedMotion);
      marked.push(element);
    }
    markedPeerElementsRef.current = marked;
  }, [
    bubbleAreaRef,
    clearPeerTwoHopStars,
    directPeerIds,
    peerTwoHopStarCounts,
    prefersReducedMotion,
  ]);

  const syncBubbleRefs = useCallback(() => {
    const area = bubbleAreaRef.current;
    if (!area || !selectedBubbleId) {
      sourceRef.current = null;
      connectedElementsRef.current = [];
      return;
    }

    sourceRef.current = findBubbleElement(area, selectedBubbleId);
    connectedElementsRef.current = directPeerIds
      .map((id) => findBubbleElement(area, id))
      .filter((el): el is HTMLElement => el != null);
  }, [bubbleAreaRef, selectedBubbleId, directPeerIds]);

  useLayoutEffect(() => {
    syncBubbleRefs();
  }, [syncBubbleRefs]);

  const { isPulling, handlers, starParticleCount } = useConnectionPullInteraction({
    sourceRef,
    connectedElementsRef,
    enabled: pullEnabled,
  });

  const pullHandlers = useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        syncBubbleRefs();
        handlers.onPointerDown(event);
      },
    }),
    [handlers, syncBubbleRefs],
  );

  useLayoutEffect(() => {
    if (isPulling) {
      applyPeerTwoHopStars();
      return () => {
        clearPeerTwoHopStars();
      };
    }
    clearPeerTwoHopStars();
    return undefined;
  }, [isPulling, applyPeerTwoHopStars, clearPeerTwoHopStars]);

  useEffect(() => {
    if (!isConnectionsContextEnabled) {
      clearPeerTwoHopStars();
    }
  }, [isConnectionsContextEnabled, clearPeerTwoHopStars]);

  useEffect(() => {
    if (isPulling) {
      applyPeerTwoHopStars();
    }
  }, [connections, directPeerIds, peerTwoHopStarCounts, prefersReducedMotion, isPulling, applyPeerTwoHopStars]);

  useEffect(() => {
    if (wasPullingRef.current && !isPulling) {
      suppressClickAfterPullRef.current = true;
      requestAnimationFrame(() => {
        suppressClickAfterPullRef.current = false;
      });
    }
    wasPullingRef.current = isPulling;
  }, [isPulling]);

  return {
    isPulling,
    pullEnabled,
    pullHandleVisible,
    handlers: pullHandlers,
    starParticleCount,
    directPeerIds,
    twoHopPeerCount,
    suppressClickAfterPullRef,
    syncBubbleRefs,
  };
}
