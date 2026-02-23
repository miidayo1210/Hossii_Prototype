import type { UserProfile, SpaceNicknames } from '../types/profile';

const PROFILE_KEY = 'hossii.profile';
const SPACE_NICKNAMES_KEY = 'hossii.spaceNicknames';

/**
 * プロフィールを読み込む
 */
export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id,
      defaultNickname: parsed.defaultNickname || '',
      createdAt: parsed.createdAt instanceof Date
        ? parsed.createdAt
        : new Date(parsed.createdAt),
    };
  } catch {
    return null;
  }
}

/**
 * プロフィールを保存
 */
export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/**
 * スペースごとのニックネームを読み込む
 */
export function loadSpaceNicknames(): SpaceNicknames {
  try {
    const raw = localStorage.getItem(SPACE_NICKNAMES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SpaceNicknames;
  } catch {
    return {};
  }
}

/**
 * スペースごとのニックネームを保存
 */
export function saveSpaceNicknames(map: SpaceNicknames): void {
  try {
    localStorage.setItem(SPACE_NICKNAMES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * 特定のスペースのニックネームを設定
 */
export function setSpaceNickname(spaceId: string, nickname: string): void {
  const map = loadSpaceNicknames();
  map[spaceId] = nickname.trim();
  saveSpaceNicknames(map);
}

/**
 * 特定のスペースのニックネームを取得（未設定なら空文字）
 */
export function getSpaceNickname(spaceId: string): string {
  const map = loadSpaceNicknames();
  return map[spaceId] || '';
}
