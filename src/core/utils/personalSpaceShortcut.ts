/**
 * 個人スペースショートカット（スペース画面の Pane タブ列に出す「わたし」ボタン）を
 * 表示してよいかを判定する純粋関数。
 *
 * 正本は「現在表示している shared space の community_id」と、そのコミュニティでの
 * membership 状態。localStorage で選ばれた community だけに依存しない。
 *
 * - 未ログイン（ゲスト）では非表示
 * - 他人のスペースを閲覧中（visiting）では非表示
 * - スペースに community_id が無ければ非表示
 * - そのコミュニティでの membership が active 以外（suspended/removed/なし）では非表示
 */
export type PersonalSpaceShortcutParams = {
  isAuthenticated: boolean;
  isVisiting: boolean;
  spaceCommunityId: string | null | undefined;
  membershipStatus: string | null | undefined;
};

export function canShowPersonalShortcut(params: PersonalSpaceShortcutParams): boolean {
  if (!params.isAuthenticated) return false;
  if (params.isVisiting) return false;
  if (!params.spaceCommunityId) return false;
  return params.membershipStatus === 'active';
}

/**
 * マイスペースタブが表示されないとき、ユーザーに伝える短い理由（121）。
 * 表示不要なら null（ゲスト・visiting など）。
 */
export function getPersonalShortcutHiddenReason(
  params: PersonalSpaceShortcutParams,
): string | null {
  if (params.isVisiting) return null;
  if (!params.spaceCommunityId) return null;
  if (!params.isAuthenticated) {
    return 'ログインすると、マイスペースタブが使えるようになります。';
  }
  switch (params.membershipStatus) {
    case 'suspended':
      return 'コミュニティの利用が一時停止されているため、マイスペースタブは表示されません。';
    case 'removed':
      return 'このコミュニティのメンバーではないため、マイスペースタブは表示されません。';
    case 'invited':
      return '招待を承認すると、マイスペースタブが使えるようになります。';
    case 'active':
      return null;
    default:
      return 'コミュニティに参加すると、マイスペースタブが表示されます。';
  }
}

/** shared スペース画面の shell か（legacy で spaceType 未設定のときも shared 扱い）。 */
export function isSharedSpaceShell(
  spaceType: 'shared' | 'personal' | null | undefined,
): boolean {
  return spaceType !== 'personal';
}

/**
 * 現在開いているスペースが「ログイン本人のコミュニティ個人スペース」かどうかを
 * DB 正本（spaces.space_type / owner_user_id）だけで判定する純粋関数。
 * URL・表示名では判定しない。「わたし」タブの active 表示に使う。
 *
 * - space_type='personal' かつ owner_user_id=auth.uid() のときのみ true
 * - shared スペースでは false
 * - 他人の personal スペース（管理者が閲覧中など）では false
 * - 未ログイン・owner 不明では false
 */
export type OwnPersonalSpaceParams = {
  spaceType: 'shared' | 'personal' | null | undefined;
  spaceOwnerUserId: string | null | undefined;
  currentUserId: string | null | undefined;
};

export function isViewingOwnPersonalSpace(params: OwnPersonalSpaceParams): boolean {
  if (params.spaceType !== 'personal') return false;
  if (!params.currentUserId) return false;
  return !!params.spaceOwnerUserId && params.spaceOwnerUserId === params.currentUserId;
}
