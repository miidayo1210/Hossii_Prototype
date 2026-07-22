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
