/**
 * Account 所属表示（コミュニティ / 参加スペース）の取得ソースを決める。
 * - participant: 発行元 space_participant_accounts 経路のみ（membership 横断禁止）
 * - regular: 既存の community_memberships / space_memberships 一覧
 */
export type AccountAffiliationSource = 'issued_participant_scope' | 'memberships';

export function resolveAccountAffiliationSource(
  isIssuedParticipant: boolean | undefined,
): AccountAffiliationSource {
  return isIssuedParticipant === true ? 'issued_participant_scope' : 'memberships';
}
