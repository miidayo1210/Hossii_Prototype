import type { ChallengeResponseConfig } from '../types/challengeProgram';

/** Exactly three options are required for choice3 items. */
export const CHALLENGE_CHOICE3_OPTION_COUNT = 3;

/** Per-option label length (stored snapshot also fits comment max 500). */
export const CHALLENGE_CHOICE3_OPTION_MAX_LENGTH = 80;

export type ChallengeChoice3Options = [
  string,
  string,
  string,
];

export function emptyChallengeChoice3Options(): ChallengeChoice3Options {
  return ['', '', ''];
}

/**
 * Normalize / validate choice3 options from form or response_config.
 * Returns exactly 3 trimmed labels, or an error message.
 */
export function normalizeChallengeChoice3Options(
  raw: unknown,
): { ok: true; value: ChallengeChoice3Options } | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: '選択肢を3つ入力してください' };
  }
  if (raw.length !== CHALLENGE_CHOICE3_OPTION_COUNT) {
    return { ok: false, message: '選択肢はちょうど3つ必要です' };
  }

  const options: string[] = [];
  for (let i = 0; i < CHALLENGE_CHOICE3_OPTION_COUNT; i += 1) {
    const entry = raw[i];
    if (typeof entry !== 'string') {
      return { ok: false, message: `選択肢${i + 1}を入力してください` };
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      return { ok: false, message: `選択肢${i + 1}を入力してください` };
    }
    if (trimmed.length > CHALLENGE_CHOICE3_OPTION_MAX_LENGTH) {
      return {
        ok: false,
        message: `選択肢${i + 1}は${CHALLENGE_CHOICE3_OPTION_MAX_LENGTH}文字以内で入力してください`,
      };
    }
    options.push(trimmed);
  }

  return {
    ok: true,
    value: options as ChallengeChoice3Options,
  };
}

/** Build response_config for a choice3 item, or null for other types. */
export function buildChoice3ResponseConfig(
  options: readonly string[],
): ChallengeResponseConfig | null {
  const normalized = normalizeChallengeChoice3Options(options);
  if (!normalized.ok) return null;
  return { options: [...normalized.value] };
}

/** Read options from item.responseConfig; returns null if invalid. */
export function parseChallengeChoice3Options(
  config: ChallengeResponseConfig | null | undefined,
): ChallengeChoice3Options | null {
  if (!config || typeof config !== 'object') return null;
  const normalized = normalizeChallengeChoice3Options(
    (config as { options?: unknown }).options,
  );
  return normalized.ok ? normalized.value : null;
}

/** Index of selected label in current options, or -1. */
export function findChallengeChoice3OptionIndex(
  options: readonly string[],
  selectedLabel: string,
): number {
  const target = selectedLabel.trim();
  if (!target) return -1;
  return options.findIndex((option) => option === target);
}
