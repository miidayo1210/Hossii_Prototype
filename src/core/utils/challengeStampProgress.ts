import type { ChallengeItem } from '../types/challengeProgram';
import type { ChallengeCompletion, ChallengeReward } from '../types/challengeReward';
import { isChallengeHossiiKey } from '../assets/challengeHossiiKeys';

/** UI derivation only — not a DB source of truth. */
export type ChallengeStampSlot = {
  index: number;
  item: ChallengeItem;
  completion: ChallengeCompletion | null;
  reward: ChallengeReward | null;
  /** True when completion exists (achievement SoT). */
  achieved: boolean;
  /** Resolved image key, or null when missing/invalid. */
  hossiiKey: string | null;
};

export type ChallengeStampProgress = {
  requiredTotal: number;
  requiredDone: number;
  optionalTotal: number;
  optionalDone: number;
  remainingRequired: number;
  /** All required items completed; if no required items, all items completed. */
  isComplete: boolean;
  /** Completion uses all items because required count is 0. */
  treatsAllAsOptional: boolean;
};

export function compareChallengeItems(a: ChallengeItem, b: ChallengeItem): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const aTime = a.createdAt.getTime();
  const bTime = b.createdAt.getTime();
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

export function buildChallengeStampSlots(
  items: ChallengeItem[],
  completions: ChallengeCompletion[],
  rewards: ChallengeReward[],
): ChallengeStampSlot[] {
  const completionByItem = new Map(completions.map((c) => [c.itemId, c]));
  const rewardByItem = new Map(rewards.map((r) => [r.itemId, r]));

  if (import.meta.env.DEV) {
    for (const reward of rewards) {
      if (!completionByItem.has(reward.itemId)) {
        console.warn(
          '[challenge] reward without matching completion',
          reward.itemId,
        );
      }
    }
  }

  return [...items].sort(compareChallengeItems).map((item, index) => {
    const completion = completionByItem.get(item.id) ?? null;
    const reward = rewardByItem.get(item.id) ?? null;
    const rawKey = reward?.hossiiKey?.trim() || null;
    const hossiiKey =
      completion && rawKey && isChallengeHossiiKey(rawKey) ? rawKey : null;

    return {
      index: index + 1,
      item,
      completion,
      reward: completion ? reward : null,
      achieved: completion != null,
      hossiiKey,
    };
  });
}

export function getChallengeStampProgress(
  slots: ChallengeStampSlot[],
): ChallengeStampProgress {
  const required = slots.filter((s) => s.item.isRequired);
  const optional = slots.filter((s) => !s.item.isRequired);
  const requiredDone = required.filter((s) => s.achieved).length;
  const optionalDone = optional.filter((s) => s.achieved).length;
  const treatsAllAsOptional = slots.length > 0 && required.length === 0;
  const isComplete = treatsAllAsOptional
    ? slots.every((s) => s.achieved)
    : required.length > 0 && requiredDone === required.length;

  return {
    requiredTotal: required.length,
    requiredDone,
    optionalTotal: optional.length,
    optionalDone,
    remainingRequired: treatsAllAsOptional
      ? Math.max(slots.length - slots.filter((s) => s.achieved).length, 0)
      : Math.max(required.length - requiredDone, 0),
    isComplete,
    treatsAllAsOptional,
  };
}

/** Desktop column guidance; callers may clamp for narrow viewports. */
export function getStampGridColumns(itemCount: number, narrow = false): number {
  if (itemCount <= 0) return 1;
  // Mobile: collect stamps in ~3 columns (≈1/3 width each).
  if (narrow) {
    if (itemCount <= 1) return 1;
    if (itemCount === 2) return 2;
    return 3;
  }
  if (itemCount <= 3) return 3;
  if (itemCount <= 8) return 4;
  return 5;
}

export function formatRemainingLabel(progress: ChallengeStampProgress): string {
  if (progress.isComplete) {
    return progress.treatsAllAsOptional
      ? '挑戦状クリア！すべてのミッションを達成しました'
      : '挑戦状クリア！すべての必須の挑戦を達成しました';
  }
  return `あと${progress.remainingRequired}つでクリア`;
}

/** Optional leftover after required clear; null when not applicable. */
export function formatOptionalLeftoverLabel(
  progress: ChallengeStampProgress,
): string | null {
  if (!progress.isComplete || progress.treatsAllAsOptional) return null;
  const left = progress.optionalTotal - progress.optionalDone;
  if (left <= 0) return null;
  return `おまけの挑戦があと${left}つあります`;
}

export function formatCollectedHossiiLabel(slots: readonly ChallengeStampSlot[]): string {
  const collected = slots.filter((slot) => slot.achieved).length;
  return `${collected}つのHossiiを集めました`;
}

/** How many stamp slots to show in the collapsed preview. */
export function getStampPreviewLimit(total: number): number {
  if (total <= 0) return 0;
  return Math.min(4, total);
}

/** Auto-expand stamp details when the set is small. */
export function shouldAutoExpandStampDetails(total: number): boolean {
  return total > 0 && total <= 4;
}

/** Post-award celebration modal branch (UI-4). Reuses stamp completion rules. */
export type ChallengeRewardCelebrationKind =
  | 'continue'
  | 'clear_optional'
  | 'complete';

export function resolveChallengeRewardCelebrationKind(
  progress: ChallengeStampProgress,
  hasNextFocusItem: boolean,
): ChallengeRewardCelebrationKind {
  if (!progress.isComplete) return 'continue';
  if (hasNextFocusItem) return 'clear_optional';
  return 'complete';
}

/** Compact progress line for the reward celebration modal. */
export function formatRewardCelebrationProgressLabel(
  progress: ChallengeStampProgress,
  totalItems: number,
): string {
  if (progress.isComplete) {
    if (
      !progress.treatsAllAsOptional &&
      progress.optionalTotal - progress.optionalDone > 0
    ) {
      return `必須 ${progress.requiredDone} / ${progress.requiredTotal} 達成`;
    }
    return `${totalItems} / ${totalItems} 完了`;
  }
  if (progress.treatsAllAsOptional) {
    const done = progress.optionalDone + progress.requiredDone;
    return `達成 ${done} / ${totalItems}`;
  }
  return `必須 ${progress.requiredDone} / ${progress.requiredTotal}`;
}

/** List-card progress derived with the same completion rules as stamp progress. */
export type ChallengeListStatus =
  | 'not_started'
  | 'in_progress'
  | 'cleared'
  | 'completed';

export type ChallengeListProgress = {
  total: number;
  achieved: number;
  /** Remaining items needed for clear (required, or all when no required). */
  remaining: number;
  started: boolean;
  /** Cleared (required done, or all when no required). Kept for existing callers. */
  isComplete: boolean;
  requiredTotal: number;
  requiredDone: number;
  optionalTotal: number;
  optionalDone: number;
  remainingRequired: number;
  remainingOptional: number;
  isCleared: boolean;
  /** All items completed (complete / コンプリート). */
  isCompletedAll: boolean;
  listStatus: ChallengeListStatus;
};

export function getChallengeListProgress(
  items: readonly Pick<ChallengeItem, 'id' | 'isRequired'>[],
  completedItemIds: ReadonlySet<string> | readonly string[],
): ChallengeListProgress {
  const completed =
    completedItemIds instanceof Set
      ? completedItemIds
      : new Set(completedItemIds);
  const total = items.length;
  const achieved = items.reduce(
    (count, item) => count + (completed.has(item.id) ? 1 : 0),
    0,
  );
  const required = items.filter((item) => item.isRequired);
  const optional = items.filter((item) => !item.isRequired);
  const requiredDone = required.reduce(
    (count, item) => count + (completed.has(item.id) ? 1 : 0),
    0,
  );
  const optionalDone = optional.reduce(
    (count, item) => count + (completed.has(item.id) ? 1 : 0),
    0,
  );
  const treatsAllAsOptional = total > 0 && required.length === 0;
  const isCleared =
    total > 0 &&
    (treatsAllAsOptional
      ? items.every((item) => completed.has(item.id))
      : requiredDone === required.length);
  const isCompletedAll = total > 0 && achieved === total;
  const remaining = treatsAllAsOptional
    ? Math.max(total - achieved, 0)
    : Math.max(required.length - requiredDone, 0);
  const remainingRequired = treatsAllAsOptional
    ? Math.max(total - achieved, 0)
    : Math.max(required.length - requiredDone, 0);
  const remainingOptional = Math.max(optional.length - optionalDone, 0);

  let listStatus: ChallengeListStatus = 'not_started';
  if (total === 0) {
    listStatus = 'not_started';
  } else if (isCompletedAll) {
    listStatus = 'completed';
  } else if (isCleared) {
    listStatus = 'cleared';
  } else if (achieved > 0) {
    listStatus = 'in_progress';
  }

  return {
    total,
    achieved,
    remaining,
    started: achieved > 0,
    isComplete: isCleared,
    requiredTotal: required.length,
    requiredDone,
    optionalTotal: optional.length,
    optionalDone,
    remainingRequired,
    remainingOptional,
    isCleared,
    isCompletedAll,
    listStatus,
  };
}

/** Participant list CTA — state is shown via badges, not CTA wording. */
export function getChallengeListCtaLabel(): string {
  return '開く';
}

export function getChallengeListStatusLabel(
  status: ChallengeListStatus,
  itemCount = 1,
): string {
  if (itemCount <= 0) return '準備中';
  switch (status) {
    case 'completed':
      return 'コンプリート';
    case 'cleared':
      return 'クリア済み';
    case 'in_progress':
      return '挑戦中';
    case 'not_started':
    default:
      return 'まだこれから';
  }
}

/** Short supporting line under the progress bar for list cards. */
export function getChallengeListStatusHint(
  progress: ChallengeListProgress,
): string {
  if (progress.total <= 0) {
    return 'まだ挑戦できる項目がありません';
  }
  switch (progress.listStatus) {
    case 'completed':
      return 'すべての挑戦を達成しました';
    case 'cleared':
      if (progress.remainingOptional > 0) {
        return `おまけがあと${progress.remainingOptional}つあります`;
      }
      return 'クリアに必要な挑戦を達成しました';
    case 'in_progress':
      return `あと${Math.max(progress.total - progress.achieved, 0)}つ`;
    case 'not_started':
    default:
      return '最初の挑戦から始めてみよう';
  }
}

/** Accessible name for the list CTA button. */
export function getChallengeListOpenLabel(title: string): string {
  const trimmed = title.trim() || '挑戦状';
  return `「${trimmed}」を開く`;
}

/** Next item to emphasize on the participant detail screen. */
export function pickNextChallengeFocusItemId(
  items: readonly ChallengeItem[],
  answeredItemIds: ReadonlySet<string> | readonly string[],
): string | null {
  const answered =
    answeredItemIds instanceof Set
      ? answeredItemIds
      : new Set(answeredItemIds);
  const sorted = [...items].sort(compareChallengeItems);
  const nextRequired = sorted.find(
    (item) => item.isRequired && !answered.has(item.id),
  );
  if (nextRequired) return nextRequired.id;
  const nextOptional = sorted.find(
    (item) => !item.isRequired && !answered.has(item.id),
  );
  return nextOptional?.id ?? null;
}

export function hasUnansweredRequiredChallengeItems(
  items: readonly ChallengeItem[],
  answeredItemIds: ReadonlySet<string> | readonly string[],
): boolean {
  const answered =
    answeredItemIds instanceof Set
      ? answeredItemIds
      : new Set(answeredItemIds);
  return items.some((item) => item.isRequired && !answered.has(item.id));
}
