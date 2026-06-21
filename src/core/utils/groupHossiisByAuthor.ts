import type { Hossii } from '../types';
import type { AuthorPostGroup } from './authorPostGroup';
import type { AuthorGroupSort } from './displayPrefsStorage';

export type { AuthorPostGroup } from './authorPostGroup';
export type { AuthorGroupSort } from './displayPrefsStorage';

const RECENT_MS = 5 * 60 * 1000;

function getGroupKey(hossii: Hossii): string {
  if (hossii.authorId) return `id:${hossii.authorId}`;
  const name = hossii.authorName?.trim();
  if (name) return `name:${name}`;
  return `post:${hossii.id}`;
}

function getAuthorName(hossii: Hossii): string {
  return hossii.authorName?.trim() || '名無し';
}

/**
 * 表示対象の Hossii を投稿者キーでグループ化する。
 * グループ内は createdAt 昇順。並び順は sortAuthorGroups で適用する。
 */
export function groupHossiisByAuthor(hossiis: Hossii[]): AuthorPostGroup[] {
  const map = new Map<string, { authorId?: string; authorName: string; posts: Hossii[] }>();

  for (const hossii of hossiis) {
    const groupKey = getGroupKey(hossii);
    const existing = map.get(groupKey);
    if (existing) {
      existing.posts.push(hossii);
    } else {
      map.set(groupKey, {
        authorId: hossii.authorId,
        authorName: getAuthorName(hossii),
        posts: [hossii],
      });
    }
  }

  const now = Date.now();
  const groups: AuthorPostGroup[] = [];

  for (const [groupKey, { authorId, authorName, posts }] of map) {
    posts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const latestPost = posts[posts.length - 1]!;
    groups.push({
      groupKey,
      authorId,
      authorName,
      posts,
      latestPost,
      isRecent: now - latestPost.createdAt.getTime() < RECENT_MS,
    });
  }

  return groups;
}

/** 投稿者グループの並び替え（左→右の表示順） */
export function sortAuthorGroups(
  groups: AuthorPostGroup[],
  sort: AuthorGroupSort,
): AuthorPostGroup[] {
  const sorted = [...groups];
  switch (sort) {
    case 'firstPostAsc':
      sorted.sort(
        (a, b) =>
          a.posts[0]!.createdAt.getTime() - b.posts[0]!.createdAt.getTime(),
      );
      break;
    case 'latestDesc':
      sorted.sort(
        (a, b) =>
          b.latestPost.createdAt.getTime() - a.latestPost.createdAt.getTime(),
      );
      break;
    case 'postCountDesc':
      sorted.sort((a, b) => {
        const countDiff = b.posts.length - a.posts.length;
        if (countDiff !== 0) return countDiff;
        return b.latestPost.createdAt.getTime() - a.latestPost.createdAt.getTime();
      });
      break;
  }
  return sorted;
}
