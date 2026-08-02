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
  title: '気分は？',
  description: null,
  reason: null,
  responseType: 'choice3',
  isRequired: true,
  sortOrder: 0,
  responseVisibility: null,
  responseConfig: { options: ['良い', '普通', '悪い'] },
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  cleanup();
});

describe('ChallengeItemCard choice3', () => {
  it('shows three options and saves when one is selected', () => {
    const onSave = vi.fn();
    const onDraftChange = vi.fn();
    render(
      <ChallengeItemCard
        item={item}
        index={1}
        existing={undefined}
        draft={{ comment: '' }}
        resolvedVisibility="manager_only"
        saving={false}
        expanded
        emphasized
        panelId="panel-1"
        onExpand={() => undefined}
        onCollapse={() => undefined}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('radio', { name: '良い' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '普通' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '悪い' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /回答を保存/ }),
    ).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('radio', { name: '普通' }));
    expect(onDraftChange).toHaveBeenCalledWith({ comment: '普通' });
  });

  it('shows current selection on rewrite and keeps rewrite menu', () => {
    const existing: ChallengeResponse = {
      id: 'r1',
      itemId: 'i1',
      userId: 'u1',
      visibility: 'space_members',
      comment: '良い',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(
      <ChallengeItemCard
        item={item}
        index={1}
        existing={existing}
        draft={{ comment: '良い' }}
        resolvedVisibility="manager_only"
        saving={false}
        expanded
        emphasized
        panelId="panel-1"
        showManageActions
        onExpand={() => undefined}
        onCollapse={() => undefined}
        onDraftChange={() => undefined}
        onSave={() => undefined}
        onRewrite={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.getByText(/保存済み/)).toBeTruthy();
    expect(
      (screen.getByRole('radio', { name: '良い' }) as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /回答操作/ }));
    expect(screen.getByRole('menuitem', { name: '書き直す' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '回答を削除' })).toBeTruthy();
  });
});
