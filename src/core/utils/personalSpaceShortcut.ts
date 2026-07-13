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
