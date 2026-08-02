// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import { ChallengeItemCard } from './ChallengeItemCard';

const item: ChallengeItem = {
  id: 'i1',
  programId: 'p1',
  itemType: 'mission',
  title: 'ミッション完了',
  description: null,
  reason: null,
  responseType: 'complete_button',
  isRequired: true,
  sortOrder: 0,
  responseVisibility: null,
  responseConfig: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  cleanup();
});

describe('ChallengeItemCard complete_button', () => {
  it('shows complete CTA without textarea', () => {
    const onSave = vi.fn();
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
        onDraftChange={() => undefined}
        onSave={onSave}
      />,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /完了する/ }));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows completed state without rewrite controls', () => {
    const existing: ChallengeResponse = {
      id: 'r1',
      itemId: 'i1',
      userId: 'u1',
      visibility: 'space_members',
      comment: '完了しました',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(
      <ChallengeItemCard
        item={item}
        index={1}
        existing={existing}
        draft={{ comment: '完了しました' }}
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
        onDelete={() => undefined}
      />,
    );

    expect(screen.getByText(/完了済み/)).toBeTruthy();
    expect(screen.getByText(/完了しました/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^完了する$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /回答操作/ }));
    expect(screen.getByRole('menuitem', { name: '回答を削除' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: '書き直す' })).toBeNull();
  });
});
