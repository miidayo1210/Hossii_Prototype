// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeCompletion, ChallengeReward } from '../../core/types/challengeReward';
import type { ChallengeStampSlot } from '../../core/utils/challengeStampProgress';
import { ChallengeStampCard } from './ChallengeStampCard';

vi.mock('../../core/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

afterEach(() => {
  cleanup();
});

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

function slot(partial: Partial<ChallengeStampSlot> & { item: ChallengeItem }): ChallengeStampSlot {
  return {
    index: 1,
    completion: null,
    reward: null,
    achieved: false,
    hossiiKey: null,
    ...partial,
  };
}

describe('ChallengeStampCard', () => {
  it('renders empty stamp for unfinished slot', () => {
    render(
      <ChallengeStampCard
        slots={[
          slot({
            item: item({ id: 'i1', title: '朝の気持ち' }),
          }),
        ]}
      />,
    );
    expect(screen.getByText('未達成')).toBeTruthy();
    expect(screen.getByText('質問・必須')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders hossii image and progress for achieved slots', () => {
    const completion: ChallengeCompletion = {
      id: 'c1',
      itemId: 'i1',
      userId: 'u1',
      responseId: null,
      completedAt: new Date(),
      createdAt: new Date(),
    };
    const reward: ChallengeReward = {
      id: 'r1',
      completionId: 'c1',
      userId: 'u1',
      itemId: 'i1',
      hossiiKey: 'emotion/wow',
      awardedAt: new Date(),
      createdAt: new Date(),
    };
    render(
      <ChallengeStampCard
        slots={[
          slot({
            index: 1,
            item: item({ id: 'i1', title: '朝の気持ち', isRequired: true }),
            completion,
            reward,
            achieved: true,
            hossiiKey: 'emotion/wow',
          }),
          slot({
            index: 2,
            item: item({
              id: 'i2',
              title: 'おまけ',
              isRequired: false,
              sortOrder: 1,
            }),
            achieved: false,
          }),
        ]}
      />,
    );
    expect(screen.getByText('1 / 1')).toBeTruthy();
    expect(screen.getByText('0 / 1')).toBeTruthy();
    expect(screen.getByText(/挑戦状クリア/)).toBeTruthy();
    const img = screen.getByRole('img', { name: /獲得Hossii/ });
    expect(img.getAttribute('src')).toContain('/hossii/emotion/wow.png');
    expect(screen.getByText('達成済み')).toBeTruthy();
    expect(screen.getByText('未達成')).toBeTruthy();
  });

  it('shows clear message when complete', () => {
    render(
      <ChallengeStampCard
        slots={[
          slot({
            item: item({ id: 'i1', title: '必須だけ' }),
            achieved: true,
            hossiiKey: 'idle/idle_smile',
            completion: {
              id: 'c1',
              itemId: 'i1',
              userId: 'u1',
              responseId: null,
              completedAt: new Date(),
              createdAt: new Date(),
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/挑戦状クリア/)).toBeTruthy();
    expect(
      screen.getByText(/一度獲得したHossiiスタンプは、回答を削除しても残ります/),
    ).toBeTruthy();
  });
});
