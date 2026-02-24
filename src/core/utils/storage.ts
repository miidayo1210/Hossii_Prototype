import type { Space, SpaceId } from '../types/space';
import type { Hossii } from '../types';

// localStorage キー
const SPACES_KEY = 'hossii.spaces';
const ACTIVE_SPACE_ID_KEY = 'hossii.activeSpaceId';
const HOSSIIS_KEY = 'hossii.hossiis';

/**
 * スペースリストを読み込む（生データ）
 * 正規化は useHossiiStore 側の normalizeSpace() で行う
 */
export function loadSpaces(): unknown[] {
  try {
    const raw = localStorage.getItem(SPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * スペースリストを保存
 * 一時画像（source: 'temp'）は保存対象から除外
 */
export function saveSpaces(spaces: Space[]): void {
  try {
    const toSave = spaces.map((f) => {
      // 一時画像の場合は background を除外
      if (f.background?.kind === 'image' && f.background.source === 'temp') {
      return {
        id: f.id,
        spaceURL: f.spaceURL,
        name: f.name,
        cardType: f.cardType,
        quickEmotions: f.quickEmotions,
        createdAt: f.createdAt.toISOString(),
        // background は保存しない（一時画像のため）
      };
      }

      return {
        id: f.id,
        spaceURL: f.spaceURL,
        name: f.name,
        cardType: f.cardType,
        quickEmotions: f.quickEmotions,
        createdAt: f.createdAt.toISOString(),
        background: f.background, // 背景設定を保存
      };
    });
    localStorage.setItem(SPACES_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

/**
 * アクティブスペースIDを読み込む
 */
export function loadActiveSpaceId(): SpaceId | null {
  try {
    return localStorage.getItem(ACTIVE_SPACE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * アクティブスペースIDを保存
 */
export function saveActiveSpaceId(id: SpaceId): void {
  try {
    localStorage.setItem(ACTIVE_SPACE_ID_KEY, id);
  } catch {
    // ignore
  }
}

/**
 * Hossiis を読み込む（生データ）
 * 正規化は useHossiiStore 側の normalizeHossii() で行う
 */
export function loadHossiis(): unknown[] {
  try {
    const raw = localStorage.getItem(HOSSIIS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Hossiis を保存
 */
export function saveHossiis(hossiis: Hossii[]): void {
  try {
    const toSave = hossiis.map((h) => ({
      id: h.id,
      message: h.message,
      emotion: h.emotion,
      spaceId: h.spaceId,
      authorId: h.authorId,
      authorName: h.authorName,
      createdAt: h.createdAt.toISOString(),
      logType: h.logType,
      speechLevel: h.speechLevel,
      origin: h.origin,
      autoType: h.autoType,
      language: h.language, // undefined preserved for old logs
    }));
    localStorage.setItem(HOSSIIS_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

/**
 * Hossiis のストレージキーを取得（イベントリスナー用）
 */
export function getHossiisStorageKey(): string {
  return HOSSIIS_KEY;
}
