import type { Space } from '../types/space';
import type { PostFieldConfig, PostFieldSettings, SpaceModeSnapshot, SpaceModeState, SpaceSettings } from '../types/settings';
import {
  DEFAULT_POSTING_SETTINGS,
  DEFAULT_REFLECTION_SETTINGS,
  DEFAULT_SPACE_MODE_STATE,
} from '../types/settings';
import { mergePostFieldSettings, type PostFieldKey } from './postFieldSettings';

const FIELD_KEYS: PostFieldKey[] = [
  'message',
  'emotion',
  'tags',
  'photo',
  'bubbleColor',
  'bubbleShape',
  'numberPost',
];

function fieldEqual(a: PostFieldConfig, b: PostFieldConfig): boolean {
  return a.enabled === b.enabled && a.required === b.required;
}

function postFieldsEqual(a: PostFieldSettings, b: PostFieldSettings): boolean {
  return FIELD_KEYS.every((k) => fieldEqual(a[k], b[k]));
}

export function extractModeSnapshot(space: Space, settings: SpaceSettings): SpaceModeSnapshot {
  const postFields = mergePostFieldSettings(settings.postFields);
  return {
    isPrivate: space.isPrivate ?? false,
    likesEnabled: settings.features.likesEnabled,
    positionMode: settings.posting?.positionMode ?? DEFAULT_POSTING_SETTINGS.positionMode,
    randomRecallEnabled:
      settings.reflection?.randomRecallEnabled ?? DEFAULT_REFLECTION_SETTINGS.randomRecallEnabled,
    bubbleEditPermission: settings.bubbleEditPermission ?? 'all',
    postFields,
  };
}

export function snapshotsEqual(a: SpaceModeSnapshot, b: SpaceModeSnapshot): boolean {
  return (
    a.isPrivate === b.isPrivate &&
    a.likesEnabled === b.likesEnabled &&
    a.positionMode === b.positionMode &&
    a.randomRecallEnabled === b.randomRecallEnabled &&
    a.bubbleEditPermission === b.bubbleEditPermission &&
    postFieldsEqual(a.postFields, b.postFields)
  );
}

export function detectModeCustomization(
  space: Space,
  settings: SpaceSettings,
  modeState: SpaceModeState,
): boolean {
  if (!modeState.snapshot) return false;
  const current = extractModeSnapshot(space, settings);
  return !snapshotsEqual(current, modeState.snapshot);
}

export function refreshModeCustomization(
  space: Space,
  settings: SpaceSettings,
): SpaceModeState | undefined {
  const mode = settings.mode ?? DEFAULT_SPACE_MODE_STATE;
  if (!mode.snapshot) {
    if (mode.isCustomized) {
      return { ...mode, isCustomized: false };
    }
    return undefined;
  }
  const isCustomized = detectModeCustomization(space, settings, mode);
  if (isCustomized === mode.isCustomized) return undefined;
  return { ...mode, isCustomized };
}
