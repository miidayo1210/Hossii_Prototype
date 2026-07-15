import { useCallback, useEffect, useRef, useState } from 'react';
import type { HossiiGuideSettings } from '../types/settings';
import {
  GUIDE_BUBBLE_INITIAL_DELAY_MS,
  resolveGuideDisplayMessage,
} from '../utils/hossiiGuide';

type Options = {
  spaceId: string | null | undefined;
  hossiiGuide: HossiiGuideSettings | undefined;
  /** 初期表示完了・必要データ読み込み済み */
  displayReady: boolean;
  /** モーダル・ローディング等で表示をブロック */
  blocked: boolean;
};

/**
 * 117: スペース初回ガイド吹き出しの表示制御（メモリ保持・1回のみ）
 */
export function useHossiiGuideBubble({
  spaceId,
  hossiiGuide,
  displayReady,
  blocked,
}: Options) {
  const dismissedSpaceIdsRef = useRef<Set<string>>(new Set());
  const autoShownSpaceIdsRef = useRef<Set<string>>(new Set());
  const [guideMessage, setGuideMessage] = useState<string | null>(null);
  const prevSpaceIdRef = useRef<string | null | undefined>(spaceId);

  const dismissGuide = useCallback(() => {
    if (!spaceId) return;
    dismissedSpaceIdsRef.current.add(spaceId);
    setGuideMessage(null);
  }, [spaceId]);

  useEffect(() => {
    if (prevSpaceIdRef.current !== spaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on space change only
      setGuideMessage(null);
      prevSpaceIdRef.current = spaceId;
    }

    if (!spaceId || !displayReady || blocked) {
      return;
    }
    if (dismissedSpaceIdsRef.current.has(spaceId)) {
      return;
    }
    if (autoShownSpaceIdsRef.current.has(spaceId)) {
      return;
    }

    const message = resolveGuideDisplayMessage(hossiiGuide);
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (dismissedSpaceIdsRef.current.has(spaceId)) {
        return;
      }
      autoShownSpaceIdsRef.current.add(spaceId);
      setGuideMessage(message);
    }, GUIDE_BUBBLE_INITIAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [spaceId, hossiiGuide, displayReady, blocked]);

  return { guideMessage, dismissGuide };
}
