import type { HossiiConnection } from '../types/hossiiConnection';
import { isConnectionsContextEnabled, type ConnectionContextGate } from './connectionFetchGate';

export type ConnectionOverlayGate = ConnectionContextGate & {
  selectedBubbleId: string | null;
};

/** custom Bubble 表示かつ選択中のみ overlay を描画。
 *  archived スペースでも閲覧可（作成・変更・解除は後続 UI / API 担当）。
 *  isContentArchived は gate に含めない。 */
export function shouldShowConnectionOverlay(gate: ConnectionOverlayGate): boolean {
  return isConnectionsContextEnabled(gate) && gate.selectedBubbleId != null;
}

export type VisibleConnectionFilter = {
  connections: HossiiConnection[];
  selectedBubbleId: string;
  activePaneId: string;
  visibleHossiiIds: ReadonlySet<string>;
};

/** 選択 root から 1 階層・同一 Pane・表示中 Hossii のみ */
export function filterVisibleConnections({
  connections,
  selectedBubbleId,
  activePaneId,
  visibleHossiiIds,
}: VisibleConnectionFilter): HossiiConnection[] {
  return connections.filter((connection) => {
    if (connection.paneId !== activePaneId) return false;
    const touchesSelected =
      connection.sourceHossiiId === selectedBubbleId ||
      connection.targetHossiiId === selectedBubbleId;
    if (!touchesSelected) return false;
    return (
      visibleHossiiIds.has(connection.sourceHossiiId) &&
      visibleHossiiIds.has(connection.targetHossiiId)
    );
  });
}

/** 選択 root から 1 階層の糸件数（✦N 表示の正本） */
export function countDirectConnections(filter: VisibleConnectionFilter): number {
  return filterVisibleConnections(filter).length;
}

export type DirectConnectionListItem = {
  connectionId: string;
  peerHossiiId: string;
  strength: HossiiConnection['strength'];
};

/** つながり N 一覧: 1-hop・方向非依存の peer 一覧 */
export function buildDirectConnectionListItems(
  filter: VisibleConnectionFilter,
): DirectConnectionListItem[] {
  return filterVisibleConnections(filter).map((connection) => ({
    connectionId: connection.id,
    peerHossiiId:
      connection.sourceHossiiId === filter.selectedBubbleId
        ? connection.targetHossiiId
        : connection.sourceHossiiId,
    strength: connection.strength,
  }));
}

/** 選択 root から 1-hop の peer Hossii ID 一覧 */
export function getDirectPeerHossiiIds(filter: VisibleConnectionFilter): string[] {
  return buildDirectConnectionListItems(filter).map((item) => item.peerHossiiId);
}

/** 選択 root から 2-hop で到達可能な visible Hossii 件数（1-hop peer 自身は除外） */
export function countVisibleTwoHopPeers({
  connections,
  selectedBubbleId,
  activePaneId,
  visibleHossiiIds,
}: VisibleConnectionFilter): number {
  const directPeers = new Set(getDirectPeerHossiiIds({
    connections,
    selectedBubbleId,
    activePaneId,
    visibleHossiiIds,
  }));
  if (directPeers.size === 0) return 0;

  const twoHopIds = new Set<string>();
  for (const connection of connections) {
    if (connection.paneId !== activePaneId) continue;
    const { sourceHossiiId, targetHossiiId } = connection;

    if (
      directPeers.has(sourceHossiiId) &&
      targetHossiiId !== selectedBubbleId &&
      !directPeers.has(targetHossiiId) &&
      visibleHossiiIds.has(targetHossiiId)
    ) {
      twoHopIds.add(targetHossiiId);
    }
    if (
      directPeers.has(targetHossiiId) &&
      sourceHossiiId !== selectedBubbleId &&
      !directPeers.has(sourceHossiiId) &&
      visibleHossiiIds.has(sourceHossiiId)
    ) {
      twoHopIds.add(sourceHossiiId);
    }
  }

  return twoHopIds.size;
}

/** 通常時 ✦N: 表示中 Hossii ごとの 1 階層接続件数 */
export function buildConnectionBadgeCounts(
  connections: HossiiConnection[],
  activePaneId: string,
  visibleHossiiIds: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const connection of connections) {
    if (connection.paneId !== activePaneId) continue;
    if (
      !visibleHossiiIds.has(connection.sourceHossiiId) ||
      !visibleHossiiIds.has(connection.targetHossiiId)
    ) {
      continue;
    }

    counts.set(
      connection.sourceHossiiId,
      (counts.get(connection.sourceHossiiId) ?? 0) + 1,
    );
    counts.set(
      connection.targetHossiiId,
      (counts.get(connection.targetHossiiId) ?? 0) + 1,
    );
  }

  return counts;
}
