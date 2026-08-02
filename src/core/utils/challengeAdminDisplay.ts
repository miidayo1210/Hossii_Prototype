/** Display helpers for challenge admin UI (no DB source of truth). */

import {
  CHALLENGE_TITLE_MAX_LENGTH,
  type ChallengeResponseType,
} from '../types/challengeProgram';
import {
  normalizeChallengeChoice3Options,
  parseChallengeChoice3Options,
} from './challengeChoice3';

/** UI guidance for description/reason (DB text is unbounded). */
export const CHALLENGE_ITEM_BODY_MAX_LENGTH = 1000;

const ANSWERABLE_RESPONSE_TYPES = new Set<string>([
  'comment',
  'complete_button',
  'choice3',
  'photo',
]);

export type ChallengeItemCountStats = {
  total: number;
  required: number;
  optional: number;
};

export type ChallengePublishCheckItem = {
  id: string;
  ok: boolean;
  label: string;
  /** When true, failing this check blocks publish. */
  blocking: boolean;
};

export type ChallengePublishItemInput = {
  title: string;
  isRequired: boolean;
  responseType: string;
  responseConfig?: Record<string, unknown> | null;
};

export type ChallengePublishGateInput = {
  title: string;
  items: ReadonlyArray<ChallengePublishItemInput>;
  hasUnsavedProgramEdits: boolean;
  hasOpenItemForm: boolean;
};

export type ChallengePublishReadiness = {
  checks: ChallengePublishCheckItem[];
  canPublish: boolean;
  blockReason: string | null;
};

export function challengeResponseTypeLabel(
  responseType: ChallengeResponseType | string,
): string {
  if (responseType === 'complete_button') return '完了ボタン';
  if (responseType === 'choice3') return '3択';
  if (responseType === 'photo') return '写真';
  return 'コメント';
}

export function challengeResponseTypeAdminHelp(
  responseType: ChallengeResponseType | string,
): string {
  if (responseType === 'complete_button') {
    return '参加者が「完了する」を押すだけで達成します';
  }
  if (responseType === 'choice3') {
    return '参加者が3つの選択肢から1つ選んで回答します';
  }
  if (responseType === 'photo') {
    return '参加者が写真1枚をアップロードして回答します。コメントはありません。';
  }
  return '参加者が短文を入力して回答します';
}

export function challengeItemTypeLabel(itemType: 'question' | 'mission' | string): string {
  return itemType === 'mission' ? 'ミッション' : '質問';
}

export function challengeItemTypeHelp(itemType: 'question' | 'mission' | string): string {
  if (itemType === 'mission') {
    return '行動したことや、できたことに取り組んでもらう項目です';
  }
  return '考えたことや気づきを答えてもらう項目です';
}

export function buildChallengePublishChecks(
  input: ChallengePublishGateInput,
): ChallengePublishCheckItem[] {
  const titleOk = input.title.trim().length > 0;
  const itemTotal = input.items.length;
  const itemsOk = itemTotal > 0;
  const answerableCount = input.items.filter((item) =>
    ANSWERABLE_RESPONSE_TYPES.has(item.responseType),
  ).length;
  const answerableOk = answerableCount > 0;
  const invalidChoice3 = input.items.find(
    (item) =>
      item.responseType === 'choice3' &&
      !parseChallengeChoice3Options(item.responseConfig ?? null),
  );
  const choice3Ok = !invalidChoice3;
  const unsavedOk = !input.hasUnsavedProgramEdits;
  const formClosedOk = !input.hasOpenItemForm;
  const requiredTotal = input.items.filter((item) => item.isRequired).length;

  const checks: ChallengePublishCheckItem[] = [
    {
      id: 'title',
      ok: titleOk,
      blocking: true,
      label: titleOk
        ? 'タイトルが入力されています'
        : 'タイトルを入力してください',
    },
    {
      id: 'items',
      ok: itemsOk,
      blocking: true,
      label: itemsOk
        ? `質問・ミッションが${itemTotal}件あります`
        : '質問またはミッションを1件以上追加してください',
    },
    {
      id: 'answerable',
      ok: !itemsOk || answerableOk,
      blocking: true,
      label: !itemsOk
        ? '回答できる形式の項目を追加してください'
        : answerableOk
          ? '回答できる形式の項目があります'
          : '公開するにはコメント・完了ボタン・3択・写真形式の項目が1件以上必要です',
    },
    {
      id: 'choice3',
      ok: choice3Ok,
      blocking: true,
      label: choice3Ok
        ? '3択の選択肢が揃っています'
        : `「${invalidChoice3?.title ?? '項目'}」の選択肢が3つ揃っていません。公開前に編集してください。`,
    },
    {
      id: 'unsaved',
      ok: unsavedOk,
      blocking: true,
      label: unsavedOk
        ? '挑戦状の内容は保存済みです'
        : '未保存の変更があります。先に「下書きを保存」してください',
    },
    {
      id: 'itemForm',
      ok: formClosedOk,
      blocking: true,
      label: formClosedOk
        ? '項目の編集は完了しています'
        : '項目の編集中です。保存または入力をやめてから公開してください',
    },
    {
      id: 'required',
      ok: true,
      blocking: false,
      label:
        requiredTotal > 0
          ? `クリアに必要な項目が${requiredTotal}件あります`
          : itemsOk
            ? 'クリアに必要な項目は0件です（全項目達成でクリアになります）'
            : 'クリアに必要な項目はまだありません',
    },
  ];

  return checks;
}

export function evaluateChallengePublishReadiness(
  input: ChallengePublishGateInput,
): ChallengePublishReadiness {
  const checks = buildChallengePublishChecks(input);
  const blockingFailed = checks.find((check) => check.blocking && !check.ok);
  return {
    checks,
    canPublish: !blockingFailed,
    blockReason: blockingFailed?.label ?? null,
  };
}

export function validateChallengeItemForm(input: {
  title: string;
  description: string;
  reason: string;
  responseType?: ChallengeResponseType;
  choiceOptions?: readonly string[];
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
  if (input.responseType === 'choice3') {
    const options = normalizeChallengeChoice3Options(input.choiceOptions ?? []);
    if (!options.ok) return options.message;
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
