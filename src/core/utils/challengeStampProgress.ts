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
  if (narrow) {
    if (itemCount <= 4) return 2;
    if (itemCount <= 16) return 3;
    return 4;
  }
  if (itemCount <= 4) return 2;
  if (itemCount <= 9) return 3;
  if (itemCount <= 16) return 4;
  return 5;
}

export function formatRemainingLabel(progress: ChallengeStampProgress): string {
  if (progress.isComplete) {
    return progress.treatsAllAsOptional
      ? '挑戦状クリア！すべてのミッションを達成しました'
      : '挑戦状クリア！すべての必須ミッションを達成しました';
  }
  return `あと${progress.remainingRequired}つでクリア`;
}
