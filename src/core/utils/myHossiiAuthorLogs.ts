import type { Hossii } from '../types';
import type { AuthorPostGroup } from './authorPostGroup';
import { groupHossiisByAuthor } from './groupHossiisByAuthor';

export type ResolveAuthorGroupParams = {
  userId: string;
  nickname: string;
  spaceId: string;
};

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

export function createEmptyAuthorGroup(params: ResolveAuthorGroupParams): AuthorPostGroup {
  const placeholder = createPlaceholderPost(params);
  return {
    groupKey: `id:${params.userId}`,
    authorId: params.userId,
    authorName: params.nickname,
    posts: [],
    latestPost: placeholder,
    isRecent: false,
  };
}

/**
 * マイHossii参加者のログ表示用に投稿者グループを解決する。
 * Auth UID一致 → ニックネーム一致（旧 profile ID 投稿の救済）→ 空グループの順。
 */
export function resolveAuthorGroupForMyHossiiUser(
  hossiis: Hossii[],
  params: ResolveAuthorGroupParams,
): AuthorPostGroup {
  const visible = filterSpacePosts(hossiis, params.spaceId);
  const groups = groupHossiisByAuthor(visible);
  const normalizedNickname = normalizeName(params.nickname);

  const byAuthUid = groups.find((g) => g.authorId === params.userId);
  if (byAuthUid) return byAuthUid;

  if (normalizedNickname) {
    const byNickname = groups.find(
      (g) => normalizeName(g.authorName) === normalizedNickname,
    );
    if (byNickname) return byNickname;
  }

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
