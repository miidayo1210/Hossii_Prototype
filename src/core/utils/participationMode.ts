import type { ParticipationMode } from '../types/space';

export const DEFAULT_PARTICIPATION_MODE: ParticipationMode = 'guest_and_account';

const VALID_PARTICIPATION_MODES: ReadonlySet<ParticipationMode> = new Set([
  'guest_only',
  'guest_and_account',
  'account_only',
]);

/**
 * DB / localStorage / mock から ParticipationMode を正規化する。
 * 未知値・空白付き文字列は default（guest_and_account）へフォールバックする。
 */
export function normalizeParticipationMode(value: unknown): ParticipationMode {
  if (typeof value !== 'string' || value === '') {
    return DEFAULT_PARTICIPATION_MODE;
  }
  if (VALID_PARTICIPATION_MODES.has(value as ParticipationMode)) {
    return value as ParticipationMode;
  }
  return DEFAULT_PARTICIPATION_MODE;
}
