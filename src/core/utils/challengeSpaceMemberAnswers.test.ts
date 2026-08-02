import { describe, expect, it } from 'vitest';
import type { ChallengeResponse } from '../types/challengeResponse';
import {
  CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE,
  formatSpaceMemberAnswerLabel,
  groupChallengeResponsesByItemId,
} from './challengeSpaceMemberAnswers';

function response(
  partial: Partial<ChallengeResponse> & Pick<ChallengeResponse, 'id' | 'itemId' | 'userId'>,
): ChallengeResponse {
  return {
    visibility: 'space_members',
    comment: 'hi',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...partial,
  };
}

describe('formatSpaceMemberAnswerLabel', () => {
  it('labels the current user as あなた', () => {
    expect(
      formatSpaceMemberAnswerLabel({
        userId: 'u1',
        currentUserId: 'u1',
        names: { u1: 'Nick' },
      }),
    ).toBe('あなた');
  });

  it('uses nickname when available', () => {
    expect(
      formatSpaceMemberAnswerLabel({
        userId: 'u2',
        currentUserId: 'u1',
        names: { u2: 'みゆ' },
      }),
    ).toBe('みゆ');
  });

  it('falls back to 参加者', () => {
    expect(
      formatSpaceMemberAnswerLabel({
        userId: 'u3',
        currentUserId: 'u1',
        names: {},
      }),
    ).toBe('参加者');
  });
});

describe('groupChallengeResponsesByItemId', () => {
  it('groups responses by item', () => {
    const grouped = groupChallengeResponsesByItemId([
      response({ id: 'a', itemId: 'i1', userId: 'u1' }),
      response({ id: 'b', itemId: 'i2', userId: 'u2' }),
      response({ id: 'c', itemId: 'i1', userId: 'u3' }),
    ]);
    expect(grouped.i1?.map((r) => r.id)).toEqual(['a', 'c']);
    expect(grouped.i2?.map((r) => r.id)).toEqual(['b']);
  });
});

describe('CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE', () => {
  it('keeps a compact page size for mobile', () => {
    expect(CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE).toBe(5);
  });
});
