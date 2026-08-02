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
  responseVisibility: null,
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

const reward = {
  id: 'rw1',
  completionId: 'c1',
  userId: 'u1',
  itemId: 'i1',
  hossiiKey: 'emotion/wow',
  awardedAt: new Date(),
  createdAt: new Date(),
};

describe('ChallengeRecallModal', () => {
  it('keeps rewrite/delete in … menu without a bottom rewrite button', () => {
    const onRewrite = vi.fn();
    render(
      <ChallengeRecallModal
        model={{ item, response, completion, reward }}
        onRewrite={onRewrite}
        onAnswerAgain={vi.fn()}
        onDelete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('思い出の回答')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '書き直す' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /の回答操作/ }));
    expect(screen.getByRole('menuitem', { name: '書き直す' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '回答を削除' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: '書き直す' }));
    expect(onRewrite).toHaveBeenCalled();
  });

  it('closes from the top control', () => {
    const onDismiss = vi.fn();
    render(
      <ChallengeRecallModal
        model={{ item, response, completion, reward }}
        onRewrite={vi.fn()}
        onAnswerAgain={vi.fn()}
        onDelete={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('offers answer-again only in … menu when response is deleted', () => {
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
    expect(screen.getByText('回答は削除済みです')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /の回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'もう一度答える' }));
    expect(onAnswerAgain).toHaveBeenCalled();
  });

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    render(
      <ChallengeRecallModal
        model={{ item, response, completion, reward: null }}
        onRewrite={vi.fn()}
        onAnswerAgain={vi.fn()}
        onDelete={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });
});
