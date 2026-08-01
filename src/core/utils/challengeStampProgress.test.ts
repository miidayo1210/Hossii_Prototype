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
  getChallengeListProgress,
  getChallengeStampProgress,
  getStampGridColumns,
  getStampPreviewLimit,
  pickNextChallengeFocusItemId,
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
    expect(getStampGridColumns(3)).toBe(2);
    expect(getStampGridColumns(7)).toBe(3);
    expect(getStampGridColumns(12)).toBe(4);
    expect(getStampGridColumns(20)).toBe(5);
    expect(getStampGridColumns(20, true)).toBe(4);
  });

  it('derives list progress with the same completion rules', () => {
    expect(getChallengeListProgress([], [])).toEqual({
      total: 0,
      achieved: 0,
      remaining: 0,
      started: false,
      isComplete: false,
    });

    const withRequired = [
      item({ id: 'r1', title: '必須1', isRequired: true }),
      item({ id: 'r2', title: '必須2', isRequired: true }),
      item({ id: 'o1', title: 'おまけ', isRequired: false }),
    ];
    const mid = getChallengeListProgress(withRequired, ['r1']);
    expect(mid).toEqual({
      total: 3,
      achieved: 1,
      remaining: 1,
      started: true,
      isComplete: false,
    });
    expect(getChallengeListCtaLabel(mid)).toBe('つづける');

    const clear = getChallengeListProgress(withRequired, ['r1', 'r2']);
    expect(clear.isComplete).toBe(true);
    expect(clear.achieved).toBe(2);
    expect(getChallengeListCtaLabel(clear)).toBe('振り返る');

    const optionalOnly = [
      item({ id: 'o1', title: 'a', isRequired: false }),
      item({ id: 'o2', title: 'b', isRequired: false }),
    ];
    expect(getChallengeListProgress(optionalOnly, ['o1']).isComplete).toBe(false);
    expect(getChallengeListProgress(optionalOnly, ['o1', 'o2']).isComplete).toBe(true);
    expect(getChallengeListCtaLabel(getChallengeListProgress(optionalOnly, []))).toBe(
      '挑戦する',
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
});
