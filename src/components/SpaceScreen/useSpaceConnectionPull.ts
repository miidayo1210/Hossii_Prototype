import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import {
  getDirectPeerHossiiIds,
  countVisibleTwoHopPeers,
} from '../../core/utils/connectionVisibility';
import { useConnectionPullInteraction } from '../../core/hooks/useConnectionPullInteraction';
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
    !EDITOR_PHASES_BLOCKING_PULL.has(editorPhase) &&
    !bubbleInteractionLock.isDragging &&
    !bubbleInteractionLock.isResizing;

  const pullHandleVisible =
    isConnectionsContextEnabled && directPeerIds.length > 0;

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
    handlers,
    starParticleCount,
    directPeerIds,
    twoHopPeerCount,
    suppressClickAfterPullRef,
    syncBubbleRefs,
  };
}
