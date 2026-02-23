import type { SpaceSettings } from '../types/settings';
import { DEFAULT_SPACE_SETTINGS } from '../types/settings';

const SETTINGS_KEY_PREFIX = 'space_settings_';

/**
 * スペース設定をlocalStorageから読み込む
 */
export const loadSpaceSettings = (spaceId: string, spaceName: string): SpaceSettings => {
  const key = `${SETTINGS_KEY_PREFIX}${spaceId}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SPACE_SETTINGS,
        ...parsed,
        spaceId,
        spaceName,
      };
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
