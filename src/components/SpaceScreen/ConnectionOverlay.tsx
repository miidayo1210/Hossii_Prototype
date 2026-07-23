import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LayoutMode, ViewMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import {
  filterVisibleConnections,
  shouldShowConnectionOverlay,
} from '../../core/utils/connectionVisibility';
import { formatConnectionReasonDisplay } from '../../core/utils/formatConnectionReasonDisplay';
import { clampConnectionReasonTooltipPosition } from '../../core/utils/connectionReasonTooltipPosition';
import { getConnectionStrokeStyle } from '../../core/utils/connectionPath';
import {
  useConnectionOverlayGeometry,
  type ConnectionPathRefs,
} from './useConnectionOverlayGeometry';
import styles from './ConnectionOverlay.module.css';

export type ConnectionOverlayProps = {
  bubbleAreaRef: React.RefObject<HTMLElement | null>;
  connections: HossiiConnection[];
  selectedBubbleId: string | null;
  presentationMode: PresentationMode;
  renderAsStar: boolean;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  activePaneId: string;
  visibleHossiiIds: ReadonlySet<string>;
  /** QA / #55 メニュー連携用（overlay 描画件数と一致） */
  directConnectionCount?: number;
  /** pull 中など hit path の pointer イベントを無効化 */
  hitPathsDisabled?: boolean;
  /** admin 向け: 糸クリックで編集開始 */
  onConnectionClick?: (connection: HossiiConnection) => void;
  /** true のとき 1-hop 糸を視覚強調（描画自体は常に行う） */
  emphasized?: boolean;
};

type ConnectionHoverPoint = {
  clientX: number;
  clientY: number;
};

type ConnectionHoverState = {
  connectionId: string;
  point: ConnectionHoverPoint;
};

type ConnectionPathPairProps = {
  connection: HossiiConnection;
  isHovered: boolean;
  hitPathsDisabled: boolean;
  onHoverChange: (connectionId: string | null, point?: ConnectionHoverPoint) => void;
  onRegister: (connectionId: string, refs: ConnectionPathRefs | null) => void;
  onConnectionClick?: (connection: HossiiConnection) => void;
  /** true のとき 1-hop 糸を視覚強調（描画自体は常に行う） */
  emphasized?: boolean;
};

function ConnectionPathPair({
  connection,
  isHovered,
  hitPathsDisabled,
  onHoverChange,
  onRegister,
  onConnectionClick,
}: ConnectionPathPairProps) {
  const visualRef = useRef<SVGPathElement | null>(null);
  const hitRef = useRef<SVGPathElement | null>(null);

  const syncRegistry = useCallback(() => {
    if (visualRef.current && hitRef.current) {
      onRegister(connection.id, {
        visual: visualRef.current,
        hit: hitRef.current,
      });
    } else {
      onRegister(connection.id, null);
    }
  }, [connection.id, onRegister]);

  useEffect(() => {
    syncRegistry();
    return () => onRegister(connection.id, null);
  }, [connection.id, onRegister, syncRegistry]);

  const stroke = getConnectionStrokeStyle(connection.strength);

  const reportHover = useCallback(
    (clientX: number, clientY: number) => {
      if (hitPathsDisabled) return;
      onHoverChange(connection.id, { clientX, clientY });
    },
    [connection.id, hitPathsDisabled, onHoverChange],
  );

  return (
    <g data-connection-id={connection.id}>
      <path
        ref={(node) => {
          visualRef.current = node;
          syncRegistry();
        }}
        className={`${styles.visualPath} ${isHovered ? styles.visualPathHovered : ''}`}
        style={{
          strokeWidth: stroke.strokeWidth,
          strokeOpacity: isHovered ? Math.min(stroke.opacity + 0.2, 1) : stroke.opacity,
        }}
      />
      <path
        ref={(node) => {
          hitRef.current = node;
          syncRegistry();
        }}
        className={styles.hitPath}
        style={{
          strokeWidth: stroke.hitStrokeWidth,
          pointerEvents: hitPathsDisabled ? 'none' : 'stroke',
        }}
        onPointerEnter={(event) => {
          reportHover(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          reportHover(event.clientX, event.clientY);
        }}
        onPointerLeave={() => {
          if (hitPathsDisabled) return;
          onHoverChange(null);
        }}
        onPointerDown={(e) => {
          if (hitPathsDisabled || !onConnectionClick) return;
          e.preventDefault();
          e.stopPropagation();
          onConnectionClick(connection);
        }}
      />
    </g>
  );
}

export function ConnectionOverlay({
  bubbleAreaRef,
  connections,
  selectedBubbleId,
  presentationMode,
  renderAsStar,
  viewMode,
  layoutMode,
  activePaneId,
  visibleHossiiIds,
  directConnectionCount,
  hitPathsDisabled = false,
  onConnectionClick,
  emphasized = false,
}: ConnectionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [hoverState, setHoverState] = useState<ConnectionHoverState | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const pathRegistryRef = useRef<Map<string, ConnectionPathRefs>>(new Map());

  const gateOpen = shouldShowConnectionOverlay({
    presentationMode,
    renderAsStar,
    viewMode,
    layoutMode,
    selectedBubbleId,
  });

  const visibleConnections = useMemo(() => {
    if (!gateOpen || !selectedBubbleId) return [];
    return filterVisibleConnections({
      connections,
      selectedBubbleId,
      activePaneId,
      visibleHossiiIds,
    });
  }, [gateOpen, connections, selectedBubbleId, activePaneId, visibleHossiiIds]);

  const effectiveHoverState =
    hoverState != null &&
    !hitPathsDisabled &&
    visibleConnections.some((connection) => connection.id === hoverState.connectionId)
      ? hoverState
      : null;

  const hoveredConnection = useMemo(() => {
    if (!effectiveHoverState) return null;
    return (
      visibleConnections.find((connection) => connection.id === effectiveHoverState.connectionId) ??
      null
    );
  }, [effectiveHoverState, visibleConnections]);

  const reasonTooltipText = useMemo(() => {
    if (!hoveredConnection) return null;
    return formatConnectionReasonDisplay(
      hoveredConnection.reasonText,
      hoveredConnection.reasonEmoji,
    );
  }, [hoveredConnection]);

  const handleHoverChange = useCallback(
    (connectionId: string | null, point?: ConnectionHoverPoint) => {
      if (!connectionId || !point) {
        setHoverState(null);
        return;
      }
      setHoverState({
        connectionId,
        point,
      });
    },
    [],
  );

  useLayoutEffect(() => {
    if (!reasonTooltipText || !effectiveHoverState || !overlayRef.current || !tooltipRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear tooltip when hover ends
      setTooltipPosition(null);
      return;
    }

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measure tooltip size before clamping
    setTooltipPosition(
      clampConnectionReasonTooltipPosition({
        clientX: effectiveHoverState.point.clientX,
        clientY: effectiveHoverState.point.clientY,
        overlayRect,
        tooltipWidth: tooltipRect.width,
        tooltipHeight: tooltipRect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    );
  }, [reasonTooltipText, effectiveHoverState]);

  const registerPathRefs = useCallback((connectionId: string, refs: ConnectionPathRefs | null) => {
    if (!refs) {
      pathRegistryRef.current.delete(connectionId);
      return;
    }
    pathRegistryRef.current.set(connectionId, refs);
  }, []);

  useConnectionOverlayGeometry({
    bubbleAreaRef,
    connections: visibleConnections,
    enabled: gateOpen && visibleConnections.length > 0,
    pathRegistryRef,
  });

  if (!gateOpen || visibleConnections.length === 0) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`${styles.overlay}${emphasized ? ` ${styles.overlayEmphasized}` : ''}`}
      data-connection-overlay
      data-connection-emphasized={emphasized ? 'true' : 'false'}
      data-direct-connection-count={directConnectionCount ?? visibleConnections.length}
      data-hit-paths-disabled={hitPathsDisabled ? 'true' : 'false'}
      data-space-export="exclude"
      aria-hidden
    >
      <svg className={styles.svg} aria-hidden>
        {visibleConnections.map((connection) => (
          <ConnectionPathPair
            key={connection.id}
            connection={connection}
            isHovered={effectiveHoverState?.connectionId === connection.id}
            hitPathsDisabled={hitPathsDisabled}
            onHoverChange={handleHoverChange}
            onRegister={registerPathRefs}
            onConnectionClick={onConnectionClick}
          />
        ))}
      </svg>
      {reasonTooltipText && effectiveHoverState ? (
        <div
          ref={tooltipRef}
          className={styles.reasonTooltip}
          data-connection-reason-tooltip
          style={{
            left: tooltipPosition?.left ?? -9999,
            top: tooltipPosition?.top ?? -9999,
            visibility: tooltipPosition ? 'visible' : 'hidden',
          }}
        >
          {reasonTooltipText}
        </div>
      ) : null}
    </div>
  );
}
