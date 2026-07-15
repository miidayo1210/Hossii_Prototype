import type { MyAuthorshipIdsStatus } from './myAuthorshipIdsController';

export type CanManageOwnPostParams = {
  /** ログイン中なら true。ゲスト（未ログイン）は false */
  isAuthenticated: boolean;
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本） */
  myAuthorshipIds: ReadonlySet<string>;
  /** myAuthorshipIds の取得状態。'ready' 以外は本人操作を許可しない */
  myAuthorshipIdsStatus: MyAuthorshipIdsStatus;
  /** 判定対象の hossii ID */
  hossiiId: string;
};

/**
 * ログイン本人が自分の投稿を操作（本文編集 / 公開範囲変更 / ソフト削除）できるかを判定する純関数。
 *
 * Phase 2D-2。本人操作 RPC は authenticated のみ EXECUTE 可・auth.uid()+authorship を正本とするため、
 * UI 側も次を満たすときだけメニューを出す:
 * - ゲスト（未ログイン）は常に false（RPC 権限が無く、ゲスト投稿には本人メニューを出さない）。
 * - authorship が 'ready' でない間は false（本人性未確定のまま操作 UI を出さない）。
 * - myAuthorshipIds に hossiiId が含まれるときだけ true（author_id フォールバックはしない）。
 *
 * 純関数（Supabase 呼び出し・session 取得・console 出力・throw・state 変更なし）。
 * これは表示制御のみであり、実際の権限は DB(RPC + RLS) が担保する。
 */
export function canManageOwnPost({
  isAuthenticated,
  myAuthorshipIds,
  myAuthorshipIdsStatus,
  hossiiId,
}: CanManageOwnPostParams): boolean {
  if (!isAuthenticated) return false;
  if (myAuthorshipIdsStatus !== 'ready') return false;
  if (!hossiiId) return false;
  return myAuthorshipIds.has(hossiiId);
}
