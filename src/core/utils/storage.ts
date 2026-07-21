import type { Space, SpaceId } from '../types/space';
import type { Hossii } from '../types';
import { scopedStorageKey } from './storageScope';

function serializeSpace(f: Space): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: f.id,
    spaceURL: f.spaceURL,
    name: f.name,
    quickEmotions: f.quickEmotions,
    createdAt: f.createdAt.toISOString(),
  };
  if (f.background?.kind !== 'image' || f.background.source !== 'temp') {
    base.background = f.background;
  }
  if (f.presetTags) base.presetTags = f.presetTags;
  if (f.isPrivate !== undefined) base.isPrivate = f.isPrivate;
  if (f.welcomeMessage) base.welcomeMessage = f.welcomeMessage;
  if (f.description) base.description = f.description;
  if (f.characterName) base.characterName = f.characterName;
  if (f.characterImageUrl) base.characterImageUrl = f.characterImageUrl;
  if (f.customEmotions?.length) base.customEmotions = f.customEmotions;
  if (f.decorations?.length) base.decorations = f.decorations;
  if (f.bubbleShapePng) base.bubbleShapePng = f.bubbleShapePng;
  if (f.savedBackgroundImages?.length) base.savedBackgroundImages = f.savedBackgroundImages;
  if (f.tabFolders?.length) base.tabFolders = f.tabFolders;
  // コミュニティ / スペース種別のメタデータ（「わたし」タブの表示・active 判定に必要）。
  // reload 直後の初期描画でも復元できるよう永続化する。
  if (f.communityId) base.communityId = f.communityId;
  if (f.spaceType) base.spaceType = f.spaceType;
  if (f.ownerUserId) base.ownerUserId = f.ownerUserId;
  if (f.accessMode) base.accessMode = f.accessMode;
  if (f.participationMode) base.participationMode = f.participationMode;
  return base;
}

// localStorage キー（Project ref ごとにスコープ）
const SPACES_KEY = scopedStorageKey('hossii.spaces');
const ACTIVE_SPACE_ID_KEY = scopedStorageKey('hossii.activeSpaceId');
const HOSSIIS_KEY = scopedStorageKey('hossii.hossiis');

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
    const toSave = spaces.map(serializeSpace);
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

/** デモ（Supabase 未設定）時の localStorage 投稿上限 */
export const DEMO_MAX_HOSSIIS = 200;

/**
 * Hossiis を保存
 */
export function saveHossiis(hossiis: Hossii[]): void {
  try {
    // normalizeHossii() が復元するフィールドと揃える（省略するとリロード後に欠落する）
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
      language: h.language,
      bubbleColor: h.bubbleColor,
      bubbleShapePng: h.bubbleShapePng,
      hashtags: h.hashtags,
      tags: h.tags,
      imageUrl: h.imageUrl,
      positionX: h.positionX,
      positionY: h.positionY,
      isPositionFixed: h.isPositionFixed,
      scale: h.scale,
      isHidden: h.isHidden,
      numberValue: h.numberValue,
      likeCount: h.likeCount,
      postKind: h.postKind,
    }));
    localStorage.setItem(HOSSIIS_KEY, JSON.stringify(toSave));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn(
        '[storage] saveHossiis: localStorage quota exceeded (フリー投稿の data URL が大きすぎる可能性があります)',
      );
    }
  }
}

/**
 * Hossiis のストレージキーを取得（イベントリスナー用）
 */
export function getHossiisStorageKey(): string {
  return HOSSIIS_KEY;
}
