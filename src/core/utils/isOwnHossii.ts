export type IsOwnHossiiParams = {
  /** 判定対象の hossii ID */
  hossiiId: string;
  /** 対象投稿の author_id（表示・端末側 ID。ログイン中の本人判定には使わない） */
  hossiiAuthorId?: string | null;
  /**
   * ログイン中なら true。
   * 認証状態が未確定（loading / unknown）の間は、安全側に倒すため呼び出し側が
   * false を渡すこと。false の場合はゲスト判定（端末 ID 比較）にフォールバックする。
   */
  isAuthenticated: boolean;
  /** ゲスト（未ログイン）の端末側 author_id */
  guestAuthorId?: string | null;
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本） */
  myAuthorshipIds: ReadonlySet<string>;
};

/**
 * 投稿がビューアー本人のものかを判定する純関数。
 *
 * 本人性ルール:
 * - ログイン中: hossii_authorships 由来の myAuthorshipIds だけを正本とする。
 *   hossiis.author_id へのフォールバックは行わない（Phase 1A で確認した
 *   author_id と auth UID の不整合を持ち込まないため）。
 * - ゲスト: authorship は存在しないため、従来どおり端末側 author_id の一致で判定する。
 *
 * 純関数（Supabase 呼び出し・session 取得・console 出力・throw・state 変更なし）。
 */
export function isOwnHossii({
  hossiiId,
  hossiiAuthorId,
  isAuthenticated,
  guestAuthorId,
  myAuthorshipIds,
}: IsOwnHossiiParams): boolean {
  if (!hossiiId) {
    return false;
  }

  if (isAuthenticated) {
    return myAuthorshipIds.has(hossiiId);
  }

  return Boolean(guestAuthorId && hossiiAuthorId && guestAuthorId === hossiiAuthorId);
}
