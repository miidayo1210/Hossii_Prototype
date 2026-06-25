import type { SpaceSettings } from '../types/settings';
import { DEFAULT_SPACE_SETTINGS } from '../types/settings';
import { mergePostFieldSettings } from './postFieldSettings';

const SETTINGS_KEY_PREFIX = 'space_settings_';

function normalizeStoredFeatures(raw: unknown): SpaceSettings['features'] {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacy = f as { commentPost?: boolean; messagePost?: boolean };
  return {
    ...DEFAULT_SPACE_SETTINGS.features,
    messagePost: legacy.messagePost ?? legacy.commentPost ?? DEFAULT_SPACE_SETTINGS.features.messagePost,
    emotionPost: typeof f.emotionPost === 'boolean' ? f.emotionPost : DEFAULT_SPACE_SETTINGS.features.emotionPost,
    photoPost: typeof f.photoPost === 'boolean' ? f.photoPost : DEFAULT_SPACE_SETTINGS.features.photoPost,
    numberPost: typeof f.numberPost === 'boolean' ? f.numberPost : DEFAULT_SPACE_SETTINGS.features.numberPost,
    likesEnabled: typeof f.likesEnabled === 'boolean' ? f.likesEnabled : DEFAULT_SPACE_SETTINGS.features.likesEnabled,
  };
}

/**
 * スペース設定をlocalStorageから読み込む
 */
export const loadSpaceSettings = (spaceId: string, spaceName: string): SpaceSettings => {
  const key = `${SETTINGS_KEY_PREFIX}${spaceId}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const merged: SpaceSettings = {
        ...DEFAULT_SPACE_SETTINGS,
        ...parsed,
        spaceId,
        spaceName,
        features: normalizeStoredFeatures(parsed.features),
        postFields: mergePostFieldSettings(parsed.postFields),
        posting: parsed.posting ?? DEFAULT_SPACE_SETTINGS.posting,
        reflection: parsed.reflection ?? DEFAULT_SPACE_SETTINGS.reflection,
        mode: parsed.mode ?? DEFAULT_SPACE_SETTINGS.mode,
      };
      return merged;
    } catch (error) {
      console.error('Failed to parse space settings:', error);
    }
  }

  // デフォルト設定を返す
  return {
    spaceId,
    spaceName,
    ...DEFAULT_SPACE_SETTINGS,
  };
};

/**
 * スペース設定をlocalStorageに保存する
 */
export const saveSpaceSettings = (settings: SpaceSettings): void => {
  const key = `${SETTINGS_KEY_PREFIX}${settings.spaceId}`;
  localStorage.setItem(key, JSON.stringify(settings));
};

/**
 * 複数のスペース設定を一括読み込み
 */
export const loadAllSpaceSettings = (spaces: Array<{ id: string; name: string }>): Record<string, SpaceSettings> => {
  const settings: Record<string, SpaceSettings> = {};

  spaces.forEach((space) => {
    settings[space.id] = loadSpaceSettings(space.id, space.name);
  });

  return settings;
};
