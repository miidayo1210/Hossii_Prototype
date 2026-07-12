import type { BubbleEditPermission } from '../types/settings';
import { isOwnHossii } from './isOwnHossii';
import type { MyAuthorshipIdsStatus } from './myAuthorshipIdsController';

export type ResolveCanEditBubbleParams = {
  /** コミュニティ管理者。true なら最優先で編集可 */
  isAdmin: boolean;
  /** スペースのバブル編集権限。未設定は 'all'（既存デフォルト）扱い */
  bubbleEditPermission?: BubbleEditPermission | null;
  /** 対象投稿の ID（本人性の正本 myAuthorshipIds との照合キー） */
  hossiiId: string;
  /** 対象投稿の author_id（端末側 ID。ログイン中の本人判定には使わない） */
  hossiiAuthorId?: string | null;
  /** ログイン中なら true（currentUser 有無）。false はゲスト扱い */
  isAuthenticated: boolean;
  /** ゲスト（未ログイン）の端末側 author_id（= state.profile?.id） */
  guestAuthorId?: string | null;
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本） */
  myAuthorshipIds: ReadonlySet<string>;
  /** myAuthorshipIds の取得状態。'ready' 以外は本人編集を許可しない */
  myAuthorshipIdsStatus: MyAuthorshipIdsStatus;
};

/**
 * 吹き出し（投稿）の編集可否を判定する純関数。
 *
 * 責務分担:
 * - isOwnHossii     : 本人かどうかだけを判定する。
 * - resolveCanEditBubble: admin / permission / authorship の取得状態 / 本人性を組み合わせる。
 *
 * 判定順序（Identity A / Phase 1D-3）:
 * 1. 管理者は最優先で編集可（authorship 判定を通さない）。
 * 2. bubbleEditPermission === 'all' は全員編集可（既存仕様維持。未設定も 'all' 扱い）。
 * 3. 'owner_and_admin' 以外は編集不可。
 * 4. 本人性判定:
 *    - ログイン中: myAuthorshipIdsStatus === 'ready' のときだけ myAuthorshipIds を信頼し、
 *      hossii_authorships 由来の集合に hossii.id があるかで判定する。
 *      'idle' / 'loading' / 'error' の間は安全側で false（author_id フォールバック禁止）。
 *    - ゲスト: 従来どおり端末側 author_id の一致で判定する（isOwnHossii がゲスト分岐を保証）。
 */
export function resolveCanEditBubble({
  isAdmin,
  bubbleEditPermission,
  hossiiId,
  hossiiAuthorId,
  isAuthenticated,
  guestAuthorId,
  myAuthorshipIds,
  myAuthorshipIdsStatus,
}: ResolveCanEditBubbleParams): boolean {
  if (isAdmin) return true;

  const permission = bubbleEditPermission ?? 'all';
  if (permission === 'all') return true;
  if (permission !== 'owner_and_admin') return false;

  if (isAuthenticated) {
    // 本人性が未確定（idle/loading/error）の間は編集を許可しない。
    // 本人性未確定のまま他人へ編集権限を与えるより、一時的に編集不可になる方が安全。
    if (myAuthorshipIdsStatus !== 'ready') return false;

    return isOwnHossii({
      hossiiId,
      hossiiAuthorId,
      isAuthenticated: true,
      guestAuthorId,
      myAuthorshipIds,
    });
  }

  return isOwnHossii({
    hossiiId,
    hossiiAuthorId,
    isAuthenticated: false,
    guestAuthorId,
    myAuthorshipIds,
  });
}
