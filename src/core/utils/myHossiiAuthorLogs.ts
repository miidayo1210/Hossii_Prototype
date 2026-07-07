import type { Hossii } from '../types';
import type { AuthorPostGroup } from './authorPostGroup';
import { groupHossiisByAuthor } from './groupHossiisByAuthor';

export type ResolveAuthorGroupParams = {
  userId: string;
  nickname: string;
  spaceId: string;
  /** 旧端末 profile.id など、安全に特定できる author ID（任意） */
  legacyAuthorId?: string | null;
};

export const DEFAULT_EMPTY_AUTHOR_LOG_MESSAGE =
  'このスペースには、まだ表示できるログがありません。';

export const AMBIGUOUS_NICKNAME_AUTHOR_LOG_MESSAGE =
  '同じニックネームの参加者がいるため、\nこの人のログを特定できませんでした。';

function isVisiblePost(hossii: Hossii): boolean {
  return !hossii.isHidden;
}

function filterSpacePosts(hossiis: Hossii[], spaceId: string): Hossii[] {
  return hossiis.filter((h) => isVisiblePost(h) && h.spaceId === spaceId);
}

function normalizeName(value: string): string {
  return value.trim();
}

function createPlaceholderPost(params: ResolveAuthorGroupParams): Hossii {
  const now = new Date(0);
  return {
    id: `my-hossii-empty-${params.userId}`,
    message: '',
    spaceId: params.spaceId,
    authorId: params.userId,
    authorName: params.nickname,
    createdAt: now,
  } as Hossii;
}

export function createEmptyAuthorGroup(
  params: ResolveAuthorGroupParams,
  emptyMessage: string = DEFAULT_EMPTY_AUTHOR_LOG_MESSAGE,
): AuthorPostGroup {
  const placeholder = createPlaceholderPost(params);
  return {
    groupKey: `id:${params.userId}`,
    authorId: params.userId,
    authorName: params.nickname,
    posts: [],
    latestPost: placeholder,
    isRecent: false,
    emptyMessage,
  };
}

export function createAmbiguousAuthorGroup(params: ResolveAuthorGroupParams): AuthorPostGroup {
  return createEmptyAuthorGroup(params, AMBIGUOUS_NICKNAME_AUTHOR_LOG_MESSAGE);
}

function findGroupsByNickname(groups: AuthorPostGroup[], nickname: string): AuthorPostGroup[] {
  const normalizedNickname = normalizeName(nickname);
  if (!normalizedNickname) return [];
  return groups.filter((g) => normalizeName(g.authorName) === normalizedNickname);
}

/**
 * マイHossii参加者のログ表示用に投稿者グループを解決する。
 * Auth UID一致 → 安全な旧 author ID → 一意なニックネーム一致 → 空/曖昧の順。
 */
export function resolveAuthorGroupForMyHossiiUser(
  hossiis: Hossii[],
  params: ResolveAuthorGroupParams,
): AuthorPostGroup {
  const visible = filterSpacePosts(hossiis, params.spaceId);
  const groups = groupHossiisByAuthor(visible);

  const byAuthUid = groups.find((g) => g.authorId === params.userId);
  if (byAuthUid) return byAuthUid;

  const legacyAuthorId = params.legacyAuthorId?.trim();
  if (legacyAuthorId) {
    const byLegacyId = groups.filter((g) => g.authorId === legacyAuthorId);
    if (byLegacyId.length === 1) return byLegacyId[0]!;
  }

  const nicknameMatches = findGroupsByNickname(groups, params.nickname);
  if (nicknameMatches.length === 1) return nicknameMatches[0]!;
  if (nicknameMatches.length >= 2) return createAmbiguousAuthorGroup(params);

  return createEmptyAuthorGroup(params);
}

/** @internal テスト用 */
export function findAuthorGroupForUser(
  hossiis: Hossii[],
  userId: string,
  spaceId?: string,
) {
  const visible = spaceId
    ? filterSpacePosts(hossiis, spaceId)
    : hossiis.filter(isVisiblePost);
  const groups = groupHossiisByAuthor(visible);
  return groups.find((g) => g.authorId === userId) ?? null;
}
