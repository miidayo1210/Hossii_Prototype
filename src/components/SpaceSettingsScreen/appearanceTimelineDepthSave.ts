import type { SpaceSettings } from '../../core/types/settings';
import { resolveTimelineDepthEnabled } from '../../core/utils/resolveTimelineDepthEnabled';

/** AppearanceTab の draft 初期値（DB 正本） */
export function readTimelineDepthDraft(settings: SpaceSettings | null | undefined): boolean {
  return resolveTimelineDepthEnabled(settings);
}

/** 保存が必要か（draft と確定値の差分） */
export function isTimelineDepthDirty(
  draftEnabled: boolean,
  settings: SpaceSettings,
): boolean {
  return draftEnabled !== resolveTimelineDepthEnabled(settings);
}

/** DB 保存成功後に settings へ反映 */
export function mergeTimelineDepthIntoSettings(
  settings: SpaceSettings,
  enabled: boolean,
): SpaceSettings {
  return { ...settings, timelineDepthEnabled: enabled };
}

/** 保存時に専用 API を呼ぶか */
export function shouldPersistTimelineDepth(
  draftEnabled: boolean,
  settings: SpaceSettings,
  canManage: boolean,
): boolean {
  return canManage && isTimelineDepthDirty(draftEnabled, settings);
}
