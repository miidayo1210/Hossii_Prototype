import type { LayoutMode, ViewMode } from './displayPrefsStorage';
import type { PresentationMode } from './presentationModeStorage';

/** SpaceScreen.renderAsStar / viewMode を含む糸機能の共通 gate */
export type ConnectionContextGate = {
  /** Bubble 描画判定の正本（isMobile landscape 含む） */
  renderAsStar: boolean;
  viewMode: ViewMode;
  presentationMode: PresentationMode;
  layoutMode: LayoutMode;
};

export type ConnectionFetchGate = ConnectionContextGate & {
  spaceId: string;
  paneId: string;
};

/** fetch / overlay / count 共通の表示コンテキスト判定 */
export function isConnectionsContextEnabled(gate: ConnectionContextGate): boolean {
  return (
    gate.viewMode !== 'slideshow' &&
    !gate.renderAsStar &&
    gate.presentationMode === 'custom' &&
    gate.layoutMode !== 'byAuthor'
  );
}

/** random / ordered の PC custom Bubble のみ API fetch */
export function shouldFetchHossiiConnections(gate: ConnectionFetchGate): boolean {
  return (
    isConnectionsContextEnabled(gate) &&
    gate.spaceId.length > 0 &&
    gate.paneId.length > 0
  );
}

/** @alias isConnectionsContextEnabled */
export const connectionsEnabled = isConnectionsContextEnabled;
