import type { Hossii } from '../types';

/** 画面描画用。DB には保存しない */
export type AuthorPostGroup = {
  groupKey: string;
  authorId?: string;
  authorName: string;
  posts: Hossii[];
  latestPost: Hossii;
  /** latestPost.createdAt が現在時刻から 5分以内 */
  isRecent: boolean;
  /** ログ0件時の表示メッセージ（省略時はデフォルト文言） */
  emptyMessage?: string;
};
