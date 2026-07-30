import { describe, expect, it } from 'vitest';
import type { ChallengeItem } from '../types/challengeProgram';
import type { ChallengeCompletion, ChallengeReward } from '../types/challengeReward';
import {
  buildChallengeStampSlots,
  compareChallengeItems,
  formatRemainingLabel,
  getChallengeStampProgress,
  getStampGridColumns,
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
});
