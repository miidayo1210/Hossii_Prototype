import type { LayoutMode } from './displayPrefsStorage';
import type { PresentationMode } from './presentationModeStorage';
import type { HossiiConnection } from '../types/hossiiConnection';

export type ConnectionOverlayGate = {
  presentationMode: PresentationMode;
  isMobile: boolean;
  layoutMode: LayoutMode;
  selectedBubbleId: string | null;
};

/** custom Bubble 表示かつ選択中のみ overlay を描画。
 *  archived スペースでも閲覧可（作成・変更・解除は後続 UI / API 担当）。
 *  isContentArchived は gate に含めない。 */
export function shouldShowConnectionOverlay(gate: ConnectionOverlayGate): boolean {
  return (
    gate.presentationMode === 'custom' &&
    !gate.isMobile &&
    gate.layoutMode !== 'byAuthor' &&
    gate.selectedBubbleId != null
  );
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
