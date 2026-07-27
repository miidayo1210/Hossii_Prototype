import type { IssuedParticipantScopeResult } from './participantAccountScopeApi';
import { hasRegisteredSpaceNickname } from './spaceNicknameGate';

/**
 * 参加IDの NicknameModal 表示判定（純関数）。
 * hydrate / scope 完了前は wait。発行元以外の URL space では open しない。
 */
export type ParticipantNicknameModalDecision = 'wait' | 'open' | 'skip';

export type DecideIssuedParticipantNicknameModalInput = {
  spaceNicknamesReady: boolean;
  /** null = scope 未取得（loading）。error/ok は結果確定 */
  scope: IssuedParticipantScopeResult | null;
  /** URL / 遷移で開こうとしている space */
  urlSpaceId: string;
  spaceNicknames: Record<string, string | undefined | null>;
};

export function decideIssuedParticipantNicknameModal(
  input: DecideIssuedParticipantNicknameModalInput,
): ParticipantNicknameModalDecision {
  if (!input.spaceNicknamesReady) return 'wait';
  if (input.scope === null) return 'wait';
  if (!input.scope.ok) return 'skip';
  // 参加IDの名前登録対象は常に発行元 space。別 slug では modal を出さない。
  if (input.urlSpaceId !== input.scope.spaceId) return 'skip';
  if (hasRegisteredSpaceNickname(input.spaceNicknames, input.scope.spaceId)) {
    return 'skip';
  }
  return 'open';
}

/** ログイン pending 経路: 発行元 spaceId が既知のときの判定 */
export function decideParticipantNicknameModalForKnownSpace(input: {
  spaceNicknamesReady: boolean;
  issuingSpaceId: string;
  spaceNicknames: Record<string, string | undefined | null>;
}): ParticipantNicknameModalDecision {
  if (!input.spaceNicknamesReady) return 'wait';
  if (hasRegisteredSpaceNickname(input.spaceNicknames, input.issuingSpaceId)) {
    return 'skip';
  }
  return 'open';
}

/**
 * NicknameModal の初期入力値。
 * 参加ID: 発行元 space に保存済み nick があるときのみ。未登録は空（username/display_name 等は使わない）。
 */
export function resolveNicknameModalInitialValue(input: {
  isIssuedParticipant: boolean;
  isProfileCompletion: boolean;
  spaceNickname?: string | null;
  defaultNickname?: string | null;
  username?: string | null;
  displayName?: string | null;
}): string {
  if (input.isIssuedParticipant) {
    return input.spaceNickname?.trim() || '';
  }

  if (input.isProfileCompletion) {
    const candidates = [input.defaultNickname, input.username, input.displayName];
    for (const c of candidates) {
      const trimmed = c?.trim();
      if (trimmed) return trimmed;
    }
    return '';
  }

  return input.spaceNickname?.trim() || input.defaultNickname?.trim() || '';
}
