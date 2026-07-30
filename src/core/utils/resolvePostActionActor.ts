import type { MyAuthorshipIdsStatus } from './myAuthorshipIdsController';
import { canManageOwnPost } from './canManageOwnPost';

export type PostActionActor = 'own' | 'super_admin';

export type ResolvePostActionActorParams = {
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  myAuthorshipIds: ReadonlySet<string>;
  myAuthorshipIdsStatus: MyAuthorshipIdsStatus;
  hossiiId: string;
};

/**
 * 投稿操作 UI の主体を決める。
 * - 本人 authorship: 'own'（公開範囲トグル含む）
 * - それ以外で super_admin: 'super_admin'（本文編集・soft削除・タブ移動）
 * - 通常のコミュニティ／スペース管理者はここに含めない
 */
export function resolvePostActionActor(
  params: ResolvePostActionActorParams,
): PostActionActor | null {
  if (
    canManageOwnPost({
      isAuthenticated: params.isAuthenticated,
      myAuthorshipIds: params.myAuthorshipIds,
      myAuthorshipIdsStatus: params.myAuthorshipIdsStatus,
      hossiiId: params.hossiiId,
    })
  ) {
    return 'own';
  }
  if (params.isAuthenticated && params.isSuperAdmin && params.hossiiId) {
    return 'super_admin';
  }
  return null;
}

export function canManagePostActions(params: ResolvePostActionActorParams): boolean {
  return resolvePostActionActor(params) !== null;
}
