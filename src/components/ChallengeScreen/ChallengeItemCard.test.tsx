// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import { ChallengeItemCard } from './ChallengeItemCard';

const item: ChallengeItem = {
  id: 'i1',
  programId: 'p1',
  itemType: 'question',
  title: '今日の気持ち',
  description: null,
  reason: null,
  responseType: 'comment',
  isRequired: true,
  sortOrder: 0,
  responseVisibility: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  cleanup();
});

describe('ChallengeItemCard visibility notice', () => {
  it('shows explanation only and does not offer radio choices', () => {
    const onSave = vi.fn();
    render(
      <ChallengeItemCard
        item={item}
        index={1}
        existing={undefined}
        draft={{ comment: 'hello' }}
        resolvedVisibility="space_members"
        saving={false}
        expanded
        emphasized
        panelId="panel-1"
        onExpand={() => undefined}
        onCollapse={() => undefined}
        onDraftChange={() => undefined}
        onSave={onSave}
      />,
    );

    expect(screen.queryByRole('radio')).toBeNull();
    expect(
      screen.getByText('この回答は、スペースに参加しているみんなへ共有されます。'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));
    expect(onSave).toHaveBeenCalled();
  });

  it('keeps stamped snapshot explanation when rewriting', () => {
    const existing: ChallengeResponse = {
      id: 'r1',
      itemId: 'i1',
      userId: 'u1',
      visibility: 'self_only',
      comment: '秘密',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(
      <ChallengeItemCard
        item={item}
        index={1}
        existing={existing}
        draft={{ comment: '秘密' }}
        resolvedVisibility="space_members"
        saving={false}
        expanded
        emphasized
        panelId="panel-1"
        onExpand={() => undefined}
        onCollapse={() => undefined}
        onDraftChange={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(
      screen.getByText('この回答は、あなただけが見ることができます。'),
    ).toBeTruthy();
    expect(
      screen.queryByText('この回答は、スペースに参加しているみんなへ共有されます。'),
    ).toBeNull();
  });
});
