import { useMemo } from 'react';
import type { RefObject } from 'react';
import type { Hossii } from '../../core/types';
import type { LayoutMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import { buildDevMockHossiiConnections } from '../../demo/mockHossiiConnections';
import type { ConnectionOverlayProps } from './ConnectionOverlay';

type UseConnectionOverlayInputsOptions = {
  bubbleAreaRef: RefObject<HTMLElement | null>;
  spaceId: string;
  paneId: string;
  filteredHossiis: Hossii[];
  selectedBubbleId: string | null;
  presentationMode: PresentationMode;
  isMobile: boolean;
  layoutMode: LayoutMode;
};

/** SpaceScreen から overlay 配線を切り出し、高衝突ファイルの diff を最小化する */
export function useConnectionOverlayInputs({
  bubbleAreaRef,
  spaceId,
  paneId,
  filteredHossiis,
  selectedBubbleId,
  presentationMode,
  isMobile,
  layoutMode,
}: UseConnectionOverlayInputsOptions): ConnectionOverlayProps {
  const visibleHossiiIds = useMemo(
    () => new Set(filteredHossiis.map((h) => h.id)),
    [filteredHossiis],
  );

  const connections = useMemo(() => {
    if (!spaceId || !paneId) return [];
    return buildDevMockHossiiConnections(
      spaceId,
      paneId,
      filteredHossiis.map((h) => h.id),
    );
  }, [spaceId, paneId, filteredHossiis]);

  return {
    bubbleAreaRef,
    connections,
    selectedBubbleId,
    presentationMode,
    isMobile,
    layoutMode,
    activePaneId: paneId,
    visibleHossiiIds,
  };
}
