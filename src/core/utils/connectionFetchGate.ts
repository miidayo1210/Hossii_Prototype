import type { LayoutMode } from './displayPrefsStorage';
import type { PresentationMode } from './presentationModeStorage';

export type ConnectionFetchGate = {
  presentationMode: PresentationMode;
  isMobile: boolean;
  layoutMode: LayoutMode;
  spaceId: string;
  paneId: string;
};

/** random / ordered の PC custom Bubble のみ API fetch */
export function shouldFetchHossiiConnections(gate: ConnectionFetchGate): boolean {
  return (
    gate.presentationMode === 'custom' &&
    !gate.isMobile &&
    gate.layoutMode !== 'byAuthor' &&
    gate.spaceId.length > 0 &&
    gate.paneId.length > 0
  );
}
