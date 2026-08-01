// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import type { ChallengeCompletion } from '../../core/types/challengeReward';
import { ChallengeRecallModal } from './ChallengeRecallModal';

afterEach(() => {
  cleanup();
});

const item: ChallengeItem = {
  id: 'i1',
  programId: 'p1',
  itemType: 'question',
  title: '今日の挑戦',
  description: '説明文',
  reason: null,
  responseType: 'comment',
  isRequired: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const completion: ChallengeCompletion = {
  id: 'c1',
  itemId: 'i1',
  userId: 'u1',
  responseId: 'r1',
  completedAt: new Date('2026-08-01T00:00:00.000Z'),
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

const response: ChallengeResponse = {
  id: 'r1',
  itemId: 'i1',
  userId: 'u1',
  visibility: 'self_only',
  comment: '思い出の回答',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ChallengeRecallModal', () => {
  it('shows answer and rewrite when response exists', () => {
    const onRewrite = vi.fn();
    render(
      <ChallengeRecallModal
        model={{
          item,
          response,
          completion,
          reward: {
            id: 'rw1',
            completionId: 'c1',
            userId: 'u1',
            itemId: 'i1',
            hossiiKey: 'emotion/wow',
            awardedAt: new Date(),
            createdAt: new Date(),
          },
        }}
        onRewrite={onRewrite}
        onAnswerAgain={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('思い出の回答')).toBeTruthy();
    expect(screen.getByText('自分だけに残す')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '書き直す' }));
    expect(onRewrite).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '回答を削除' })).toBeNull();
  });

  it('shows deleted state and answer-again CTA without response', () => {
    const onAnswerAgain = vi.fn();
    render(
      <ChallengeRecallModal
        model={{
          item,
          response: null,
          completion: { ...completion, responseId: null },
          reward: null,
        }}
        onRewrite={vi.fn()}
        onAnswerAgain={onAnswerAgain}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/回答は削除済みです/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'もう一度答える' }));
    expect(onAnswerAgain).toHaveBeenCalled();
  });

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    render(
      <ChallengeRecallModal
        model={{ item, response, completion, reward: null }}
        onRewrite={vi.fn()}
        onAnswerAgain={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });
});
