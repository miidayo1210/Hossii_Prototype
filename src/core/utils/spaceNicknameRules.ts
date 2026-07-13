/** スペースニックネームの最大文字数（DB RPC の char_length チェックと一致させる） */
export const MAX_SPACE_NICKNAME_LENGTH = 50;

export type SpaceNicknameValidation =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'too_long' | 'control_char' };

/**
 * Phase 2F: スペースニックネーム入力の正規化・検証（純関数）。
 * サーバー側 update_my_space_nickname RPC と同じルールを UI 側でも適用する（UX 用の事前検証）。
 * 実際の正本チェックは DB 側が行う。
 *
 * - 前後空白を trim。
 * - 空文字は「未設定」= null（デフォルト名にフォールバック）。
 * - 50 文字超は拒否。
 * - 制御文字を含む場合は拒否。
 * - 既存に無い複雑な禁止文字ルールは新設しない。
 */
export function normalizeSpaceNickname(input: string): SpaceNicknameValidation {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > MAX_SPACE_NICKNAME_LENGTH) {
    return { ok: false, reason: 'too_long' };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, reason: 'control_char' };
  }
  return { ok: true, value: trimmed };
}
