import type { Hossii } from '../types';
import { groupHossiisByAuthor } from './groupHossiisByAuthor';
import { resolveAuthorGroupForMyHossiiUser } from './myHossiiAuthorLogs';

export type MyHossiiRecentPost = {
  id: string;
  message: string;
  createdAt: Date;
  emotion?: Hossii['emotion'];
};

export type MyHossiiActivity = {
  recentPosts: MyHossiiRecentPost[];
  lastActivityAt: Date | null;
};

const MAX_RECENT = 3;

function isVisiblePost(hossii: Hossii): boolean {
  if (hossii.isHidden) return false;
  return true;
}

/**
 * 既存 store の投稿から、対象ユーザーの直近ログを導出する。
 * 個別 DB クエリは行わない。
 */
export function deriveMyHossiiActivity(
  hossiis: Hossii[],
  userId: string,
  options?: { nickname?: string; spaceId?: string },
): MyHossiiActivity {
  const group = options?.spaceId && options.nickname
    ? resolveAuthorGroupForMyHossiiUser(hossiis, {
        userId,
        nickname: options.nickname,
        spaceId: options.spaceId,
      })
    : (() => {
        const visible = hossiis.filter(isVisiblePost);
        const groups = groupHossiisByAuthor(visible);
        return groups.find((g) => g.authorId === userId) ?? null;
      })();

  if (!group || group.posts.length === 0) {
    return { recentPosts: [], lastActivityAt: null };
  }

  const sorted = [...group.posts].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const recentPosts = sorted.slice(0, MAX_RECENT).map((post) => ({
    id: post.id,
    message: post.message,
    createdAt: post.createdAt,
    emotion: post.emotion,
  }));

  return {
    recentPosts,
    lastActivityAt: sorted[0]?.createdAt ?? null,
  };
}

export function findAuthorGroupForUser(
  hossiis: Hossii[],
  userId: string,
  nickname?: string,
  spaceId?: string,
): ReturnType<typeof resolveAuthorGroupForMyHossiiUser> | null {
  if (spaceId != null) {
    return resolveAuthorGroupForMyHossiiUser(hossiis, {
      userId,
      nickname: nickname ?? '',
      spaceId,
    });
  }
  const visible = hossiis.filter(isVisiblePost);
  const groups = groupHossiisByAuthor(visible);
  const group = groups.find((g) => g.authorId === userId);
  return group ?? null;
}
