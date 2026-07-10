import type { SpaceSettings } from '../types/settings';
import { fetchSpaceSettings } from './spaceSettingsApi';
import { resolveTimelineDepthEnabled } from './resolveTimelineDepthEnabled';
import { loadSpaceSettings, saveSpaceSettings } from './settingsStorage';

export type TimelineDepthLoadResult = {
  enabled: boolean;
  error: Error | null;
};

export type FetchSpaceSettingsFn = (
  spaceId: string,
  spaceName: string,
) => Promise<SpaceSettings>;

export type TimelineDepthState = {
  enabled: boolean;
  isLoading: boolean;
  error: Error | null;
};

export const INITIAL_TIMELINE_DEPTH_STATE: TimelineDepthState = {
  enabled: false,
  isLoading: false,
  error: null,
};

/** DB取得前・未接続時の初期値（localStorage は参照しない） */
export function getInitialTimelineDepthState(): TimelineDepthState {
  return { ...INITIAL_TIMELINE_DEPTH_STATE };
}

/** spaceId 切替直後: 一旦 false に戻してから DB 取得 */
export function getTimelineDepthStateOnSpaceChange(): TimelineDepthState {
  return { enabled: false, isLoading: true, error: null };
}

/** 非同期結果を適用してよいか（request token 方式） */
export function isTimelineDepthRequestCurrent(
  resultRequestId: number,
  currentRequestId: number,
): boolean {
  return resultRequestId === currentRequestId;
}

export async function loadTimelineDepthEnabledFromDb(
  spaceId: string,
  spaceName: string,
  fetchFn: FetchSpaceSettingsFn = fetchSpaceSettings,
): Promise<TimelineDepthLoadResult> {
  try {
    const settings = await fetchFn(spaceId, spaceName);
    return {
      enabled: resolveTimelineDepthEnabled(settings),
      error: null,
    };
  } catch (err) {
    console.warn('[timelineDepthEnabledLoader] fetch failed', err);
    return {
      enabled: false,
      error: err instanceof Error ? err : new Error('取得に失敗しました'),
    };
  }
}

/** undefined / 空 spaceId では fetch しない */
export function shouldFetchTimelineDepthEnabled(spaceId: string | null | undefined): spaceId is string {
  return typeof spaceId === 'string' && spaceId.length > 0;
}

/** DB 取得成功後のみ localStorage の timelineDepthEnabled をマージ更新 */
export function mergeTimelineDepthIntoLocalStorage(
  spaceId: string,
  spaceName: string,
  enabled: boolean,
  loadFn: typeof loadSpaceSettings = loadSpaceSettings,
  saveFn: typeof saveSpaceSettings = saveSpaceSettings,
): void {
  const current = loadFn(spaceId, spaceName);
  saveFn({ ...current, timelineDepthEnabled: enabled });
}
