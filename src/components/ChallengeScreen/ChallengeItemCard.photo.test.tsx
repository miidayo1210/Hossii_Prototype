// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import { ChallengeItemCard } from './ChallengeItemCard';

vi.mock('./ChallengePhotoImage', () => ({
  ChallengePhotoImage: ({ photoPath }: { photoPath: string }) => (
    <img alt="mock-photo" data-path={photoPath} />
  ),
}));

const item: ChallengeItem = {
  id: 'i1',
  programId: 'p1',
  itemType: 'mission',
  title: '会場の写真を撮ろう',
  description: null,
  reason: null,
  responseType: 'photo',
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

describe('ChallengeItemCard photo', () => {
  it('shows file picker and disables save until a photo is selected', () => {
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
    expect(screen.getByText('写真を選ぶ')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /写真を保存/ }),
    ).toHaveProperty('disabled', true);
  });

  it('shows saved photo and rewrite/delete actions', () => {
    const existing: ChallengeResponse = {
      id: 'r1',
      itemId: 'i1',
      userId: 'u1',
      visibility: 'space_members',
      comment: '写真',
      photoPath:
        'challenge/space/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(
      <ChallengeItemCard
        item={item}
        index={1}
        existing={existing}
        draft={{ comment: '写真' }}
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
    expect(screen.getByAltText('mock-photo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /回答操作/ }));
    expect(screen.getByRole('menuitem', { name: '書き直す' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '回答を削除' })).toBeTruthy();
  });
});
