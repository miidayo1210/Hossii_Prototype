// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem, ChallengeProgram } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import type { ChallengeCompletion, ChallengeReward } from '../../core/types/challengeReward';
import type { ChallengeStampSlot } from '../../core/utils/challengeStampProgress';
import { ChallengeTrajectoryView } from './ChallengeTrajectoryView';

vi.mock('../../core/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

afterEach(() => {
  cleanup();
});

const program: ChallengeProgram = {
  id: 'p1',
  spaceId: 's1',
  title: '春の挑戦状',
  description: 'あたたかいきろく',
  status: 'published',
  createdBy: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

function slot(
  partial: Partial<ChallengeStampSlot> & { item: ChallengeItem },
): ChallengeStampSlot {
  return {
    index: 1,
    completion: null,
    reward: null,
    achieved: false,
    hossiiKey: null,
    ...partial,
  };
}

describe('ChallengeTrajectoryView', () => {
  it('renders records page with stamp card and answers only', () => {
    const onBack = vi.fn();
    const response: ChallengeResponse = {
      id: 'r1',
      itemId: 'i1',
      userId: 'u1',
      visibility: 'manager_only',
      comment: 'はじめての気持ち',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const completion: ChallengeCompletion = {
      id: 'c1',
      itemId: 'i1',
      userId: 'u1',
      responseId: 'r1',
      completedAt: new Date('2026-08-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const reward: ChallengeReward = {
      id: 'rw1',
      completionId: 'c1',
      userId: 'u1',
      itemId: 'i1',
      hossiiKey: 'emotion/wow',
      awardedAt: new Date('2026-08-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    };

    render(
      <ChallengeTrajectoryView
        program={program}
        slots={[
          slot({
            index: 1,
            item: item({ id: 'i1', title: '朝のごあいさつ' }),
            achieved: true,
            completion,
            reward,
            hossiiKey: 'emotion/wow',
          }),
          slot({
            index: 2,
            item: item({ id: 'i2', title: '夜のふりかえり', sortOrder: 1 }),
          }),
        ]}
        responsesByItemId={{ i1: response }}
        onBack={onBack}
      />,
    );

    expect(screen.getByLabelText('挑戦の記録')).toBeTruthy();
    expect(screen.getByText('春の挑戦状')).toBeTruthy();
    expect(screen.getByLabelText('Hossiiスタンプカード')).toBeTruthy();
    expect(screen.getByText('はじめての気持ち')).toBeTruthy();
    expect(screen.queryByText('夜のふりかえり')).toBeNull();
    expect(screen.queryByText(/積み重ねた/)).toBeNull();
    expect(screen.queryByRole('button', { name: '書き直す' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '← 挑戦状へ戻る' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows deleted answer quietly when complete', () => {
    const completion: ChallengeCompletion = {
      id: 'c1',
      itemId: 'i1',
      userId: 'u1',
      responseId: null,
      completedAt: new Date('2026-08-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    };

    render(
      <ChallengeTrajectoryView
        program={program}
        slots={[
          slot({
            index: 1,
            item: item({ id: 'i1', title: '朝のごあいさつ' }),
            achieved: true,
            completion,
            reward: {
              id: 'rw1',
              completionId: 'c1',
              userId: 'u1',
              itemId: 'i1',
              hossiiKey: 'emotion/wow',
              awardedAt: new Date('2026-08-01T00:00:00.000Z'),
              createdAt: new Date('2026-08-01T00:00:00.000Z'),
            },
            hossiiKey: 'emotion/wow',
          }),
        ]}
        responsesByItemId={{}}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('クリア')).toBeTruthy();
    expect(screen.getByText('回答は削除済みです')).toBeTruthy();
    expect(screen.queryByText(/そっとしまって/)).toBeNull();
  });
});
