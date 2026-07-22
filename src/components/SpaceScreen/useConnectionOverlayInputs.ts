import { useMemo } from 'react';
import type { RefObject } from 'react';
import type { Hossii } from '../../core/types';
import type { LayoutMode, ViewMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import { useHossiiConnections } from '../../core/hooks/useHossiiConnections';
import {
  isConnectionsContextEnabled,
  shouldFetchHossiiConnections,
} from '../../core/utils/connectionFetchGate';
import {
  countDirectConnections,
  filterVisibleConnections,
  buildConnectionBadgeCounts,
} from '../../core/utils/connectionVisibility';
import type { ConnectionOverlayProps } from './ConnectionOverlay';

type UseConnectionOverlayInputsOptions = {
  bubbleAreaRef: RefObject<HTMLElement | null>;
  spaceId: string;
  paneId: string;
  filteredHossiis: Hossii[];
  selectedBubbleId: string | null;
  presentationMode: PresentationMode;
  renderAsStar: boolean;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
};

export type ConnectionOverlayInputs = {
  overlayProps: ConnectionOverlayProps;
  /** 選択 root から 1 階層の糸件数（#55 メニュー ✦N 用） */
  selectedDirectConnectionCount: number;
  connections: ReturnType<typeof useHossiiConnections>['connections'];
  refetch: ReturnType<typeof useHossiiConnections>['refetch'];
  isConnectionsContextEnabled: boolean;
  connectionBadgeCountByHossiiId: ReadonlyMap<string, number>;
};

/** SpaceScreen から overlay 配線を切り出し、高衝突ファイルの diff を最小化する */
export function useConnectionOverlayInputs({
  bubbleAreaRef,
  spaceId,
  paneId,
  filteredHossiis,
  selectedBubbleId,
  presentationMode,
  renderAsStar,
  viewMode,
  layoutMode,
}: UseConnectionOverlayInputsOptions): ConnectionOverlayInputs {
  const visibleHossiiIds = useMemo(
    () => new Set(filteredHossiis.map((h) => h.id)),
    [filteredHossiis],
  );

  const contextGate = {
    renderAsStar,
    viewMode,
    presentationMode,
    layoutMode,
  };

  const contextEnabled = isConnectionsContextEnabled(contextGate);

  const fetchEnabled = shouldFetchHossiiConnections({
    ...contextGate,
    spaceId,
    paneId,
  });

  const { connections, refetch } = useHossiiConnections({
    spaceId,
    paneId,
    enabled: fetchEnabled,
  });

  const connectionBadgeCountByHossiiId = useMemo(() => {
    if (!contextEnabled) return new Map<string, number>();
    return buildConnectionBadgeCounts(connections, paneId, visibleHossiiIds);
  }, [contextEnabled, connections, paneId, visibleHossiiIds]);

  const selectedDirectConnectionCount = useMemo(() => {
    if (!contextEnabled || !selectedBubbleId) return 0;
    return countDirectConnections({
      connections,
      selectedBubbleId,
      activePaneId: paneId,
      visibleHossiiIds,
    });
  }, [contextEnabled, connections, selectedBubbleId, paneId, visibleHossiiIds]);

  const overlayProps: ConnectionOverlayProps = {
    bubbleAreaRef,
    connections,
    selectedBubbleId,
    renderAsStar,
    viewMode,
    presentationMode,
    layoutMode,
    activePaneId: paneId,
    visibleHossiiIds,
    directConnectionCount: selectedDirectConnectionCount,
  };

  return {
    overlayProps,
    selectedDirectConnectionCount,
    connections,
    refetch,
    isConnectionsContextEnabled: contextEnabled,
    connectionBadgeCountByHossiiId,
  };
}

export { filterVisibleConnections, countDirectConnections };
