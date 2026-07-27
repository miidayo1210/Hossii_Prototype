import type { IssuedParticipantScopeResult } from './participantAccountScopeApi';

/**
 * public shared space への自動 join（join_space_as_member）を許可するか。
 *
 * 参加ID: 発行元 space のみ許可。scope 未解決・異常時は join しない（通常 join へ fallback しない）。
 * 通常アカウント: baseAllowAutoJoin のみ（既存挙動）。
 */
export type ShouldAutoJoinSpaceInput = {
  /** invite_only / personal 以外の public shared など、既存の space 種別ゲート */
  baseAllowAutoJoin: boolean;
  isIssuedParticipant: boolean;
  activeSpaceId: string | null | undefined;
  /** SelectedCommunityProvider の affiliation loading */
  affiliationLoading: boolean;
  /**
   * 取得済み issuedParticipantScope。
   * null は未取得（loading 前後を含む）。通常アカウントでは参照しない。
   */
  issuedParticipantScope: IssuedParticipantScopeResult | null;
};

export function shouldAutoJoinSpace(input: ShouldAutoJoinSpaceInput): boolean {
  if (!input.baseAllowAutoJoin) return false;
  if (!input.activeSpaceId) return false;

  if (!input.isIssuedParticipant) {
    return true;
  }

  // 参加ID: 発行元を確認できるまで join しない（通常アカウント用 join へ fallback しない）
  if (input.affiliationLoading) return false;
  if (input.issuedParticipantScope === null) return false;
  if (!input.issuedParticipantScope.ok) return false;

  return input.activeSpaceId === input.issuedParticipantScope.spaceId;
}
