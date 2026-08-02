/** Display helpers for challenge admin UI (no DB source of truth). */

import { CHALLENGE_TITLE_MAX_LENGTH } from '../types/challengeProgram';

/** UI guidance for description/reason (DB text is unbounded). */
export const CHALLENGE_ITEM_BODY_MAX_LENGTH = 1000;

export type ChallengeItemCountStats = {
  total: number;
  required: number;
  optional: number;
};

export type ChallengePublishCheckItem = {
  id: string;
  ok: boolean;
  label: string;
};

export function buildChallengePublishChecks(input: {
  title: string;
  itemTotal: number;
  requiredTotal: number;
}): ChallengePublishCheckItem[] {
  const titleOk = input.title.trim().length > 0;
  const itemsOk = input.itemTotal > 0;
  return [
    {
      id: 'title',
      ok: titleOk,
      label: titleOk
        ? 'タイトルが入力されています'
        : 'タイトルを入力してください',
    },
    {
      id: 'items',
      ok: itemsOk,
      label: itemsOk
        ? `質問・ミッションが${input.itemTotal}件あります`
        : '質問またはミッションを1件以上追加してください',
    },
    {
      id: 'required',
      ok: true,
      label:
        input.requiredTotal > 0
          ? `クリアに必要な項目が${input.requiredTotal}件あります`
          : itemsOk
            ? 'クリアに必要な項目は0件です（全項目達成でクリアになります）'
            : 'クリアに必要な項目はまだありません',
    },
  ];
}

export function validateChallengeItemForm(input: {
  title: string;
  description: string;
  reason: string;
}): string | null {
  const title = input.title.trim();
  if (!title) return '参加者に表示する問い・ミッションを入力してください';
  if (title.length > CHALLENGE_TITLE_MAX_LENGTH) {
    return `タイトルは${CHALLENGE_TITLE_MAX_LENGTH}文字以内で入力してください`;
  }
  if (input.description.length > CHALLENGE_ITEM_BODY_MAX_LENGTH) {
    return `補足説明は${CHALLENGE_ITEM_BODY_MAX_LENGTH}文字以内で入力してください`;
  }
  if (input.reason.length > CHALLENGE_ITEM_BODY_MAX_LENGTH) {
    return `この挑戦のねらいは${CHALLENGE_ITEM_BODY_MAX_LENGTH}文字以内で入力してください`;
  }
  return null;
}

export function toParticipantItemSaveError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('permission') || lower.includes('row-level') || lower.includes('rls')) {
    return 'この項目を保存する権限がありません';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return '通信に失敗しました。時間をおいて、もう一度お試しください';
  }
  return '項目を保存できませんでした。時間をおいて、もう一度お試しください';
}

export function itemFormHasContent(input: {
  title: string;
  description: string;
  reason: string;
}): boolean {
  return Boolean(
    input.title.trim() || input.description.trim() || input.reason.trim(),
  );
}

export function countChallengeItemStats(
  items: ReadonlyArray<{ isRequired: boolean }>,
): ChallengeItemCountStats {
  let required = 0;
  let optional = 0;
  for (const item of items) {
    if (item.isRequired) required += 1;
    else optional += 1;
  }
  return { total: items.length, required, optional };
}

export function clampAdminDescription(
  value: string | null | undefined,
  max = 80,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function formatChallengeResponderLabel(
  userId: string,
  names: Readonly<Record<string, string>>,
): string {
  const resolved = names[userId]?.trim();
  if (resolved) return resolved;
  return `参加者 ${userId.slice(0, 8)}`;
}

export function hasUnsavedProgramEdits(input: {
  title: string;
  description: string;
  defaultResponseVisibility: string;
  savedTitle: string;
  savedDescription: string | null;
  savedDefaultResponseVisibility: string;
}): boolean {
  return (
    input.title !== input.savedTitle ||
    input.description !== (input.savedDescription ?? '') ||
    input.defaultResponseVisibility !== input.savedDefaultResponseVisibility
  );
}
