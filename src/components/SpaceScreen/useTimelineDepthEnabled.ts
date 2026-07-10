import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  getInitialTimelineDepthState,
  getTimelineDepthStateOnSpaceChange,
  isTimelineDepthRequestCurrent,
  loadTimelineDepthEnabledFromDb,
  mergeTimelineDepthIntoLocalStorage,
  shouldFetchTimelineDepthEnabled,
  type TimelineDepthState,
} from '../../core/utils/timelineDepthEnabledLoader';

export type UseTimelineDepthEnabledResult = TimelineDepthState;

/**
 * スペース表示用: timelineDepthEnabled を DB 正本で取得する。
 * 初期値・取得前・失敗時は常に false。localStorage の古い true は採用しない。
 */
export function useTimelineDepthEnabled(
  spaceId: string | null | undefined,
  spaceName = '',
): UseTimelineDepthEnabledResult {
  const [state, setState] = useState<TimelineDepthState>(getInitialTimelineDepthState);
  const requestIdRef = useRef(0);

  const fetchFromDb = useCallback((targetSpaceId: string, targetSpaceName: string) => {
    const reqId = ++requestIdRef.current;

    setState(getTimelineDepthStateOnSpaceChange());

    void loadTimelineDepthEnabledFromDb(targetSpaceId, targetSpaceName).then(({ enabled, error }) => {
      if (!isTimelineDepthRequestCurrent(reqId, requestIdRef.current)) return;
      setState({ enabled, isLoading: false, error });
      if (!error) {
        mergeTimelineDepthIntoLocalStorage(targetSpaceId, targetSpaceName, enabled);
      }
    });
  }, []);

  useLayoutEffect(() => {
    if (!shouldFetchTimelineDepthEnabled(spaceId)) {
      requestIdRef.current += 1;
      // spaceId 喪失時は即 false へ戻す（意図的な同期リセット）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(getInitialTimelineDepthState());
      return;
    }

    fetchFromDb(spaceId, spaceName);
  }, [spaceId, spaceName, fetchFromDb]);

  return state;
}
