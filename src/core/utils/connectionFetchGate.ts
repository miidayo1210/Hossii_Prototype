import type { LayoutMode, ViewMode } from './displayPrefsStorage';
import type { PresentationMode } from './presentationModeStorage';

/** SpaceScreen.renderAsStar / viewMode を含む糸機能の共通 gate */
export type ConnectionContextGate = {
  /** Bubble 描画判定の正本（mobile portrait / PC star presentation） */
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

/** mobile portrait または star presentation のとき Star 描画 */
export function resolveRenderAsStar(params: {
  isMobilePortrait: boolean;
  presentationMode: PresentationMode;
}): boolean {
  return params.isMobilePortrait || params.presentationMode === 'stars';
}

export type MobileConnectionViewportGate = {
  isMobilePortrait: boolean;
  isMobileLandscape: boolean;
};

/** mobile portrait / landscape いずれか */
export function isMobileConnectionViewport(gate: MobileConnectionViewportGate): boolean {
  return gate.isMobilePortrait || gate.isMobileLandscape;
}

/** pull 入口（Bubble 常設 / ActionMenu / Space Hossii）を出してよい viewport */
export function shouldShowConnectionPullHandles(gate: MobileConnectionViewportGate): boolean {
  return !isMobileConnectionViewport(gate);
}

export type SpaceHossiiConnectionHandleGate = MobileConnectionViewportGate & {
  isConnectionsContextEnabled: boolean;
  hossiiVisible: boolean;
  selectedBubbleId: string | null;
  directConnectionCount: number;
};

/** Space Hossii 横のつながり入口 ✦（Phase 1: PC custom のみ） */
export function shouldShowSpaceHossiiConnectionHandle(
  gate: SpaceHossiiConnectionHandleGate,
): boolean {
  return (
    shouldShowConnectionPullHandles(gate) &&
    gate.isConnectionsContextEnabled &&
    gate.hossiiVisible &&
    gate.selectedBubbleId != null &&
    gate.directConnectionCount > 0
  );
}
