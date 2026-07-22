import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import {
  filterVisibleConnections,
  shouldShowConnectionOverlay,
} from '../../core/utils/connectionVisibility';
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
  isMobile: boolean;
  layoutMode: LayoutMode;
  activePaneId: string;
  visibleHossiiIds: ReadonlySet<string>;
  /** QA / #55 メニュー連携用（overlay 描画件数と一致） */
  directConnectionCount?: number;
};

type ConnectionPathPairProps = {
  connection: HossiiConnection;
  isHovered: boolean;
  onHoverChange: (connectionId: string | null) => void;
  onRegister: (connectionId: string, refs: ConnectionPathRefs | null) => void;
};

function ConnectionPathPair({
  connection,
  isHovered,
  onHoverChange,
  onRegister,
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
        style={{ strokeWidth: stroke.hitStrokeWidth }}
        onPointerEnter={() => onHoverChange(connection.id)}
        onPointerLeave={() => onHoverChange(null)}
      />
    </g>
  );
}

export function ConnectionOverlay({
  bubbleAreaRef,
  connections,
  selectedBubbleId,
  presentationMode,
  isMobile,
  layoutMode,
  activePaneId,
  visibleHossiiIds,
  directConnectionCount,
}: ConnectionOverlayProps) {
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const pathRegistryRef = useRef<Map<string, ConnectionPathRefs>>(new Map());

  const gateOpen = shouldShowConnectionOverlay({
    presentationMode,
    isMobile,
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

  const effectiveHoveredConnectionId =
    hoveredConnectionId != null &&
    visibleConnections.some((connection) => connection.id === hoveredConnectionId)
      ? hoveredConnectionId
      : null;

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
      className={styles.overlay}
      data-connection-overlay
      data-direct-connection-count={directConnectionCount ?? visibleConnections.length}
      data-space-export="exclude"
      aria-hidden
    >
      <svg className={styles.svg} aria-hidden>
        {visibleConnections.map((connection) => (
          <ConnectionPathPair
            key={connection.id}
            connection={connection}
            isHovered={effectiveHoveredConnectionId === connection.id}
            onHoverChange={setHoveredConnectionId}
            onRegister={registerPathRefs}
          />
        ))}
      </svg>
    </div>
  );
}
