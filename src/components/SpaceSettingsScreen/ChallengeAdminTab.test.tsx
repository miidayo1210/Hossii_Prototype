// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Space } from '../../core/types/space';
import type { ChallengeProgram } from '../../core/types/challengeProgram';

const {
  listChallengeProgramsMock,
  listChallengeItemsMock,
  createChallengeProgramMock,
  createChallengeItemMock,
  deleteChallengeProgramMock,
  canManageSpaceMock,
} = vi.hoisted(() => ({
  listChallengeProgramsMock: vi.fn(),
  listChallengeItemsMock: vi.fn(),
  createChallengeProgramMock: vi.fn(),
  createChallengeItemMock: vi.fn(),
  deleteChallengeProgramMock: vi.fn(),
  canManageSpaceMock: vi.fn(),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'admin-1',
      isAdmin: true,
      communityId: 'comm-1',
    },
  }),
}));

vi.mock('../../core/utils/spaceAdminAccess', () => ({
  canManageSpace: (...args: unknown[]) => canManageSpaceMock(...args),
}));

vi.mock('../../core/utils/challengeProgramsApi', () => ({
  listChallengePrograms: (...args: unknown[]) => listChallengeProgramsMock(...args),
  listChallengeItems: (...args: unknown[]) => listChallengeItemsMock(...args),
  createChallengeProgram: (...args: unknown[]) => createChallengeProgramMock(...args),
  updateChallengeProgram: vi.fn(),
  deleteChallengeProgram: (...args: unknown[]) => deleteChallengeProgramMock(...args),
  createChallengeItem: (...args: unknown[]) => createChallengeItemMock(...args),
  updateChallengeItem: vi.fn(),
  deleteChallengeItem: vi.fn(),
}));

import { ChallengeAdminTab } from './ChallengeAdminTab';

const space = {
  id: 'dev-space-public',
  name: 'Dev Public',
  communityId: 'comm-1',
  spaceType: 'shared' as const,
  quickEmotions: [],
  createdAt: new Date(),
} as Space;

function makeProgram(overrides: Partial<ChallengeProgram> = {}): ChallengeProgram {
  return {
    id: 'p1',
    spaceId: space.id,
    title: '下書きストーリー',
    description: '説明',
    status: 'draft',
    createdBy: 'admin-1',
    createdAt: new Date('2026-07-31T00:00:00.000Z'),
    updatedAt: new Date('2026-07-31T01:00:00.000Z'),
    ...overrides,
  };
}

describe('ChallengeAdminTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canManageSpaceMock.mockReturnValue(true);
    listChallengeProgramsMock.mockResolvedValue([]);
    listChallengeItemsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows empty state and create CTA for managers', async () => {
    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText('質問・ミッション管理')).toBeTruthy();
    expect(screen.getByText(/まだ挑戦状はありません/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '新しい挑戦状を作る' }).length).toBeGreaterThan(0);
  });

  it('lists draft programs with item counts', async () => {
    listChallengeProgramsMock.mockResolvedValue([makeProgram()]);
    listChallengeItemsMock.mockResolvedValue([
      {
        id: 'i1',
        programId: 'p1',
        itemType: 'question',
        title: 'q',
        description: null,
        reason: null,
        responseType: 'comment',
        isRequired: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText('下書きストーリー')).toBeTruthy();
    expect(screen.getByText(/項目 1 件/)).toBeTruthy();
    expect(screen.getAllByText('下書き').length).toBeGreaterThan(0);
  });

  it('creates a draft program from the create form', async () => {
    const created = makeProgram({ id: 'p-new', title: '新規下書き', description: null });
    createChallengeProgramMock.mockResolvedValue({ ok: true, value: created });
    listChallengeProgramsMock.mockResolvedValue([]);
    listChallengeItemsMock.mockResolvedValue([]);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText(/まだ挑戦状はありません/);
    fireEvent.click(screen.getAllByRole('button', { name: '新しい挑戦状を作る' })[0]);
    expect(screen.getByRole('button', { name: '下書きを作成' })).toBeTruthy();
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: '新規下書き' },
    });
    listChallengeProgramsMock.mockResolvedValue([created]);
    fireEvent.click(screen.getByRole('button', { name: '下書きを作成' }));

    await waitFor(() => {
      expect(createChallengeProgramMock).toHaveBeenCalledWith({
        spaceId: space.id,
        title: '新規下書き',
        description: '',
      });
    });
    expect(await screen.findByRole('button', { name: 'ストーリーを保存' })).toBeTruthy();
  });

  it('confirms before deleting a draft program', async () => {
    listChallengeProgramsMock.mockResolvedValue([makeProgram()]);
    listChallengeItemsMock.mockResolvedValue([]);
    deleteChallengeProgramMock.mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText('下書きストーリー');
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(deleteChallengeProgramMock).toHaveBeenCalledWith('p1');
    });
    confirmSpy.mockRestore();
  });

  it('hides management for non-managers', async () => {
    canManageSpaceMock.mockReturnValue(false);
    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText(/挑戦状を管理する権限がありません/)).toBeTruthy();
    expect(listChallengeProgramsMock).not.toHaveBeenCalled();
  });

  it('shows list load errors without calling create', async () => {
    listChallengeProgramsMock.mockRejectedValue(new Error('permission denied by RLS'));
    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText(/permission denied by RLS/)).toBeTruthy();
    expect(createChallengeProgramMock).not.toHaveBeenCalled();
  });

  it('adds a mission item with comment responseType and next sortOrder', async () => {
    const program = makeProgram();
    listChallengeProgramsMock.mockResolvedValue([program]);
    listChallengeItemsMock.mockResolvedValue([
      {
        id: 'existing',
        programId: program.id,
        itemType: 'question',
        title: '既存',
        description: null,
        reason: null,
        responseType: 'comment',
        isRequired: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    createChallengeItemMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'new-item',
        programId: program.id,
        itemType: 'mission',
        title: '新しいミッション',
        description: null,
        reason: null,
        responseType: 'comment',
        isRequired: true,
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText('下書きストーリー');
    fireEvent.click(screen.getAllByRole('button', { name: '編集' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'ミッションを追加' }));
    const textboxes = screen.getAllByRole('textbox');
    // program title/description + item title are textboxes; item title is first in item form after selects
    fireEvent.change(textboxes[textboxes.length - 3], {
      target: { value: '新しいミッション' },
    });
    fireEvent.click(screen.getByRole('button', { name: '項目を追加' }));

    await waitFor(() => {
      expect(createChallengeItemMock).toHaveBeenCalledWith(
        expect.objectContaining({
          programId: program.id,
          itemType: 'mission',
          title: '新しいミッション',
          responseType: 'comment',
          sortOrder: 3,
        }),
      );
    });
  });
});
