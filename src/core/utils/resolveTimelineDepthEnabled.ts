import type { SpaceSettings } from '../types/settings';

/** 時系列奥行き表示が有効か（未設定・false は OFF） */
export function resolveTimelineDepthEnabled(
  settings: SpaceSettings | null | undefined,
): boolean {
  return settings?.timelineDepthEnabled === true;
}
