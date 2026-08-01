import { describe, expect, it } from 'vitest';
import type { ChallengeItem } from '../types/challengeProgram';
import type { ChallengeCompletion, ChallengeReward } from '../types/challengeReward';
import {
  buildChallengeStampSlots,
  compareChallengeItems,
  formatCollectedHossiiLabel,
  formatOptionalLeftoverLabel,
  formatRemainingLabel,
  getChallengeListCtaLabel,
  getChallengeListOpenLabel,
  getChallengeListProgress,
  getChallengeListStatusHint,
  getChallengeListStatusLabel,
  getChallengeStampProgress,
  getStampGridColumns,
  formatRewardCelebrationProgressLabel,
  getStampPreviewLimit,
  pickNextChallengeFocusItemId,
  resolveChallengeRewardCelebrationKind,
  shouldAutoExpandStampDetails,
} from './challengeStampProgress';

function item(
  overrides: Partial<ChallengeItem> & Pick<ChallengeItem, 'id' | 'title'>,
): ChallengeItem {
  return {
    programId: 'p1',
    itemType: 'question',
    description: null,
    reason: null,
    responseType: 'comment',
    isRequired: true,
    sortOrder: 0,
    createdAt: new Date('2026-07-31T00:00:00.000Z'),
    updatedAt: new Date('2026-07-31T00:00:00.000Z'),
    ...overrides,
  };
}

function completion(itemId: string): ChallengeCompletion {
  return {
    id: `c-${itemId}`,
    itemId,
    userId: 'u1',
    responseId: null,
    completedAt: new Date(),
    createdAt: new Date(),
  };
}

function reward(itemId: string, hossiiKey = 'emotion/wow'): ChallengeReward {
  return {
    id: `r-${itemId}`,
    completionId: `c-${itemId}`,
    userId: 'u1',
    itemId,
    hossiiKey,
    awardedAt: new Date(),
    createdAt: new Date(),
  };
}

describe('challengeStampProgress', () => {
  it('handles zero items', () => {
    const slots = buildChallengeStampSlots([], [], []);
    const progress = getChallengeStampProgress(slots);
    expect(slots).toEqual([]);
    expect(progress.isComplete).toBe(false);
    expect(progress.requiredTotal).toBe(0);
  });

  it('sorts by sortOrder, createdAt, id', () => {
    const items = [
      item({ id: 'b', title: 'b', sortOrder: 1, createdAt: new Date('2026-07-31T02:00:00Z') }),
      item({ id: 'a', title: 'a', sortOrder: 1, createdAt: new Date('2026-07-31T01:00:00Z') }),
      item({ id: 'c', title: 'c', sortOrder: 0 }),
    ];
    const sorted = [...items].sort(compareChallengeItems).map((i) => i.id);
    expect(sorted).toEqual(['c', 'a', 'b']);
  });

  it('counts required/optional and completes when all required done', () => {
    const items = [
      item({ id: 'r1', title: '必須1', isRequired: true, sortOrder: 0 }),
      item({ id: 'r2', title: '必須2', isRequired: true, sortOrder: 1 }),
      item({ id: 'o1', title: 'おまけ', isRequired: false, sortOrder: 2 }),
    ];
    const slots = buildChallengeStampSlots(
      items,
      [completion('r1'), completion('r2')],
      [reward('r1'), reward('r2')],
    );
    const progress = getChallengeStampProgress(slots);
    expect(progress.requiredDone).toBe(2);
    expect(progress.optionalDone).toBe(0);
    expect(progress.isComplete).toBe(true);
    expect(progress.remainingRequired).toBe(0);
    expect(formatRemainingLabel(progress)).toContain('挑戦状クリア');
  });

  it('allows completion with unfinished optional items', () => {
    const items = [
      item({ id: 'r1', title: '必須', isRequired: true }),
      item({ id: 'o1', title: 'おまけ', isRequired: false, sortOrder: 1 }),
    ];
    const progress = getChallengeStampProgress(
      buildChallengeStampSlots(items, [completion('r1')], [reward('r1')]),
    );
    expect(progress.isComplete).toBe(true);
    expect(progress.optionalDone).toBe(0);
  });

  it('treats all items as completion targets when no required items', () => {
    const items = [
      item({ id: 'o1', title: 'a', isRequired: false, sortOrder: 0 }),
      item({ id: 'o2', title: 'b', isRequired: false, sortOrder: 1 }),
    ];
    const partial = getChallengeStampProgress(
      buildChallengeStampSlots(items, [completion('o1')], [reward('o1')]),
    );
    expect(partial.treatsAllAsOptional).toBe(true);
    expect(partial.isComplete).toBe(false);
    expect(partial.remainingRequired).toBe(1);

    const full = getChallengeStampProgress(
      buildChallengeStampSlots(
        items,
        [completion('o1'), completion('o2')],
        [reward('o1'), reward('o2')],
      ),
    );
    expect(full.isComplete).toBe(true);
  });

  it('marks achieved from completion even without reward image', () => {
    const slots = buildChallengeStampSlots(
      [item({ id: 'i1', title: 'q' })],
      [completion('i1')],
      [],
    );
    expect(slots[0].achieved).toBe(true);
    expect(slots[0].hossiiKey).toBeNull();
  });

  it('treats unknown hossii keys as missing image', () => {
    const slots = buildChallengeStampSlots(
      [item({ id: 'i1', title: 'q' })],
      [completion('i1')],
      [reward('i1', 'unknown/key')],
    );
    expect(slots[0].achieved).toBe(true);
    expect(slots[0].hossiiKey).toBeNull();
  });

  it('ignores reward without matching completion', () => {
    const slots = buildChallengeStampSlots(
      [item({ id: 'i1', title: 'q' })],
      [],
      [reward('i1')],
    );
    expect(slots[0].achieved).toBe(false);
    expect(slots[0].reward).toBeNull();
    expect(slots[0].hossiiKey).toBeNull();
  });

  it('chooses grid columns by item count', () => {
    expect(getStampGridColumns(0)).toBe(1);
    expect(getStampGridColumns(3)).toBe(3);
    expect(getStampGridColumns(7)).toBe(4);
    expect(getStampGridColumns(12)).toBe(5);
    expect(getStampGridColumns(20)).toBe(5);
    expect(getStampGridColumns(1, true)).toBe(1);
    expect(getStampGridColumns(2, true)).toBe(2);
    expect(getStampGridColumns(20, true)).toBe(3);
  });

  it('derives exclusive list status from completions (not responses)', () => {
    expect(getChallengeListProgress([], [])).toMatchObject({
      total: 0,
      achieved: 0,
      remaining: 0,
      started: false,
      isComplete: false,
      isCleared: false,
      isCompletedAll: false,
      listStatus: 'not_started',
    });
    expect(getChallengeListStatusLabel('not_started', 0)).toBe('準備中');
    expect(getChallengeListStatusHint(getChallengeListProgress([], []))).toBe(
      'まだ挑戦できる項目がありません',
    );

    const withRequired = [
      item({ id: 'r1', title: '必須1', isRequired: true }),
      item({ id: 'r2', title: '必須2', isRequired: true }),
      item({ id: 'o1', title: 'おまけ', isRequired: false }),
    ];

    const notStarted = getChallengeListProgress(withRequired, []);
    expect(notStarted.listStatus).toBe('not_started');
    expect(getChallengeListStatusLabel(notStarted.listStatus)).toBe('まだこれから');
    expect(getChallengeListStatusHint(notStarted)).toBe('最初の挑戦から始めてみよう');
    expect(getChallengeListCtaLabel()).toBe('開く');

    const mid = getChallengeListProgress(withRequired, ['r1']);
    expect(mid).toMatchObject({
      total: 3,
      achieved: 1,
      remaining: 1,
      started: true,
      isComplete: false,
      isCleared: false,
      isCompletedAll: false,
      listStatus: 'in_progress',
      requiredTotal: 2,
      requiredDone: 1,
      optionalTotal: 1,
      optionalDone: 0,
      remainingOptional: 1,
    });
    expect(getChallengeListStatusLabel(mid.listStatus)).toBe('挑戦中');
    expect(getChallengeListStatusHint(mid)).toBe('あと2つ');
    expect(getChallengeListCtaLabel()).toBe('開く');

    const cleared = getChallengeListProgress(withRequired, ['r1', 'r2']);
    expect(cleared.listStatus).toBe('cleared');
    expect(cleared.isCleared).toBe(true);
    expect(cleared.isCompletedAll).toBe(false);
    expect(getChallengeListStatusLabel(cleared.listStatus)).toBe('クリア済み');
    expect(getChallengeListStatusHint(cleared)).toBe('おまけがあと1つあります');
    expect(getChallengeListCtaLabel()).toBe('開く');

    const completed = getChallengeListProgress(withRequired, ['r1', 'r2', 'o1']);
    expect(completed.listStatus).toBe('completed');
    expect(completed.isCompletedAll).toBe(true);
    expect(getChallengeListStatusLabel(completed.listStatus)).toBe('コンプリート');
    expect(getChallengeListStatusHint(completed)).toBe('すべての挑戦を達成しました');
    expect(getChallengeListCtaLabel()).toBe('開く');

    const optionalOnly = [
      item({ id: 'o1', title: 'a', isRequired: false }),
      item({ id: 'o2', title: 'b', isRequired: false }),
    ];
    const optionalMid = getChallengeListProgress(optionalOnly, ['o1']);
    expect(optionalMid.listStatus).toBe('in_progress');
    expect(optionalMid.isComplete).toBe(false);
    const optionalDone = getChallengeListProgress(optionalOnly, ['o1', 'o2']);
    expect(optionalDone.listStatus).toBe('completed');
    expect(optionalDone.isComplete).toBe(true);
    expect(getChallengeListStatusLabel(optionalDone.listStatus)).toBe('コンプリート');

    expect(getChallengeListOpenLabel('下妻アカデミーの挑戦状')).toBe(
      '「下妻アカデミーの挑戦状」を開く',
    );
  });

  it('picks next focus item by required then optional stable order', () => {
    const items = [
      item({ id: 'o1', title: 'おまけ1', isRequired: false, sortOrder: 0 }),
      item({ id: 'r2', title: '必須2', isRequired: true, sortOrder: 2 }),
      item({ id: 'r1', title: '必須1', isRequired: true, sortOrder: 1 }),
    ];
    expect(pickNextChallengeFocusItemId(items, [])).toBe('r1');
    expect(pickNextChallengeFocusItemId(items, ['r1'])).toBe('r2');
    expect(pickNextChallengeFocusItemId(items, ['r1', 'r2'])).toBe('o1');
    expect(pickNextChallengeFocusItemId(items, ['r1', 'r2', 'o1'])).toBeNull();
  });

  it('formats remaining, optional leftover, and collected labels', () => {
    const incomplete = getChallengeStampProgress(
      buildChallengeStampSlots(
        [
          item({ id: 'r1', title: '必須1', isRequired: true }),
          item({ id: 'r2', title: '必須2', isRequired: true, sortOrder: 1 }),
        ],
        [completion('r1')],
        [reward('r1')],
      ),
    );
    expect(formatRemainingLabel(incomplete)).toBe('あと1つでクリア');
    expect(formatOptionalLeftoverLabel(incomplete)).toBeNull();

    const clearWithOptional = getChallengeStampProgress(
      buildChallengeStampSlots(
        [
          item({ id: 'r1', title: '必須', isRequired: true }),
          item({ id: 'o1', title: 'おまけ', isRequired: false, sortOrder: 1 }),
        ],
        [completion('r1')],
        [reward('r1')],
      ),
    );
    expect(formatRemainingLabel(clearWithOptional)).toContain(
      'すべての必須の挑戦を達成しました',
    );
    expect(formatOptionalLeftoverLabel(clearWithOptional)).toBe(
      'おまけの挑戦があと1つあります',
    );

    const slots = buildChallengeStampSlots(
      [
        item({ id: 'r1', title: '必須', isRequired: true }),
        item({ id: 'o1', title: 'おまけ', isRequired: false, sortOrder: 1 }),
      ],
      [completion('r1')],
      [reward('r1')],
    );
    expect(formatCollectedHossiiLabel(slots)).toBe('1つのHossiiを集めました');
  });

  it('limits stamp preview and auto-expand thresholds', () => {
    expect(getStampPreviewLimit(0)).toBe(0);
    expect(getStampPreviewLimit(3)).toBe(3);
    expect(getStampPreviewLimit(10)).toBe(4);
    expect(shouldAutoExpandStampDetails(0)).toBe(false);
    expect(shouldAutoExpandStampDetails(4)).toBe(true);
    expect(shouldAutoExpandStampDetails(5)).toBe(false);
  });

  it('resolves reward celebration kind from stamp progress', () => {
    const items = [
      item({ id: 'r1', title: '必須1', isRequired: true }),
      item({ id: 'r2', title: '必須2', isRequired: true, sortOrder: 1 }),
      item({ id: 'o1', title: 'おまけ', isRequired: false, sortOrder: 2 }),
    ];
    const mid = getChallengeStampProgress(
      buildChallengeStampSlots(items, [completion('r1')], [reward('r1')]),
    );
    expect(resolveChallengeRewardCelebrationKind(mid, true)).toBe('continue');
    expect(formatRewardCelebrationProgressLabel(mid, 3)).toBe('必須 1 / 2');

    const cleared = getChallengeStampProgress(
      buildChallengeStampSlots(
        items,
        [completion('r1'), completion('r2')],
        [reward('r1'), reward('r2')],
      ),
    );
    expect(resolveChallengeRewardCelebrationKind(cleared, true)).toBe(
      'clear_optional',
    );
    expect(formatRewardCelebrationProgressLabel(cleared, 3)).toBe(
      '必須 2 / 2 達成',
    );

    const allDone = getChallengeStampProgress(
      buildChallengeStampSlots(
        items,
        [completion('r1'), completion('r2'), completion('o1')],
        [reward('r1'), reward('r2'), reward('o1')],
      ),
    );
    expect(resolveChallengeRewardCelebrationKind(allDone, false)).toBe('complete');
    expect(formatRewardCelebrationProgressLabel(allDone, 3)).toBe('3 / 3 完了');
  });
});
