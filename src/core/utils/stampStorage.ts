import type { StampData, StampCardSettings, StampCardTheme } from '../types/stamp';

const STAMP_KEY_PREFIX = 'stamp_data_';
const STAMP_SETTINGS_KEY = 'stamp_card_settings';

/**
 * スタンプ数を取得
 */
export const getStampCount = (userId: string): number => {
  const key = `${STAMP_KEY_PREFIX}${userId}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const data: StampData = JSON.parse(stored);
      return data.count;
    } catch (error) {
      console.error('Failed to parse stamp data:', error);
    }
  }

  return 0;
};

/**
 * スタンプを1つ追加
 */
export const addStamp = (userId: string): number => {
  const currentCount = getStampCount(userId);
  const newCount = currentCount + 1;

  const data: StampData = {
    userId,
    count: newCount,
    lastUpdated: new Date(),
  };

  const key = `${STAMP_KEY_PREFIX}${userId}`;
  localStorage.setItem(key, JSON.stringify(data));

  return newCount;
};

/**
 * スタンプデータ全体を取得
 */
export const getStampData = (userId: string): StampData | null => {
  const key = `${STAMP_KEY_PREFIX}${userId}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const data: StampData = JSON.parse(stored);
      // Date型に変換
      data.lastUpdated = new Date(data.lastUpdated);
      return data;
    } catch (error) {
      console.error('Failed to parse stamp data:', error);
    }
  }

  return null;
};

/**
 * スタンプカードのテーマを取得
 */
export const getStampCardTheme = (): StampCardTheme => {
  const stored = localStorage.getItem(STAMP_SETTINGS_KEY);

  if (stored) {
    try {
      const settings: StampCardSettings = JSON.parse(stored);
      return settings.theme;
    } catch (error) {
      console.error('Failed to parse stamp card settings:', error);
    }
  }

  return 'grid'; // デフォルト
};

/**
 * スタンプカードのテーマを保存
 */
export const saveStampCardTheme = (theme: StampCardTheme): void => {
  const settings: StampCardSettings = { theme };
  localStorage.setItem(STAMP_SETTINGS_KEY, JSON.stringify(settings));
};

/**
 * 現在のカードで埋まっているスタンプ数を取得（0-20）
 */
export const getCurrentCardProgress = (userId: string): number => {
  const totalCount = getStampCount(userId);
  return totalCount % 20;
};

/**
 * 完成したカードの枚数を取得
 */
export const getCompletedCardCount = (userId: string): number => {
  const totalCount = getStampCount(userId);
  return Math.floor(totalCount / 20);
};
