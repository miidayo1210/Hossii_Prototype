/**
 * スペース初回ニックネーム表示判定（純関数）。
 * 参加IDアカウントは発行元スペースの space nickname のみを正本とする。
 */

/** ensureUserProfileExists が入れるアカウント共通の placeholder。登録済み判定には使わない。 */
export const PLACEHOLDER_USERNAME = 'ユーザー';

export function isPlaceholderUsername(value: string | null | undefined): boolean {
  return (value?.trim() ?? '') === PLACEHOLDER_USERNAME;
}

export function hasRegisteredSpaceNickname(
  spaceNicknames: Record<string, string | undefined | null>,
  spaceId: string,
): boolean {
  return Boolean(spaceNicknames[spaceId]?.trim());
}

export type NicknameGateInput = {
  spaceId: string;
  spaceNicknames: Record<string, string | undefined | null>;
  isIssuedParticipant: boolean;
  defaultNickname?: string | null;
  username?: string | null;
  displayName?: string | null;
};

/**
 * 当該スペースにニックネーム登録済みか。
 * - 参加ID: space_nicknames（クライアント state）の当該 space のみ
 * - 通常: 既存どおり space → defaultNickname → username → displayName
 */
export function hasNicknameForSpaceGate(input: NicknameGateInput): boolean {
  if (hasRegisteredSpaceNickname(input.spaceNicknames, input.spaceId)) {
    return true;
  }

  if (input.isIssuedParticipant) {
    return false;
  }

  if (input.defaultNickname?.trim()) return true;
  if (input.username?.trim()) return true;
  if (input.displayName?.trim()) return true;
  return false;
}

/** モーダルを出すべきか（hasNickname の逆） */
export function shouldShowNicknameModalForSpace(input: NicknameGateInput): boolean {
  return !hasNicknameForSpaceGate(input);
}

/**
 * membership auto-join 用。placeholder「ユーザー」は正式名として渡さない。
 */
export function sanitizeMembershipNicknameCandidate(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() || '';
  if (!trimmed || isPlaceholderUsername(trimmed)) return null;
  return trimmed;
}
