// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Space } from '../../core/types/space';
import type { ChallengeProgram } from '../../core/types/challengeProgram';

const {
  listChallengeProgramsMock,
  listChallengeItemsMock,
  createChallengeProgramMock,
  createChallengeItemMock,
  deleteChallengeProgramMock,
  updateChallengeProgramStatusMock,
  updateChallengeProgramMock,
  listManagerChallengeResponsesMock,
  fetchSpaceMembershipNicknamesMock,
  fetchParticipantAccountsMock,
  canManageSpaceMock,
} = vi.hoisted(() => ({
  listChallengeProgramsMock: vi.fn(),
  listChallengeItemsMock: vi.fn(),
  createChallengeProgramMock: vi.fn(),
  createChallengeItemMock: vi.fn(),
  deleteChallengeProgramMock: vi.fn(),
  updateChallengeProgramStatusMock: vi.fn(),
  updateChallengeProgramMock: vi.fn(),
  listManagerChallengeResponsesMock: vi.fn(),
  fetchSpaceMembershipNicknamesMock: vi.fn(),
  fetchParticipantAccountsMock: vi.fn(),
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
  updateChallengeProgram: (...args: unknown[]) => updateChallengeProgramMock(...args),
  updateChallengeProgramStatus: (...args: unknown[]) =>
    updateChallengeProgramStatusMock(...args),
  deleteChallengeProgram: (...args: unknown[]) => deleteChallengeProgramMock(...args),
  createChallengeItem: (...args: unknown[]) => createChallengeItemMock(...args),
  updateChallengeItem: vi.fn(),
  deleteChallengeItem: vi.fn(),
}));

vi.mock('../../core/utils/challengeResponsesApi', () => ({
  listManagerChallengeResponses: (...args: unknown[]) =>
    listManagerChallengeResponsesMock(...args),
}));

vi.mock('../../core/utils/spaceMembershipsApi', () => ({
  fetchSpaceMembershipNicknames: (...args: unknown[]) =>
    fetchSpaceMembershipNicknamesMock(...args),
}));

vi.mock('../../core/utils/participantAccountsApi', () => ({
  fetchParticipantAccounts: (...args: unknown[]) => fetchParticipantAccountsMock(...args),
}));

import { ChallengeAdminTab } from './ChallengeAdminTab';
import { SETTINGS_NAV_GROUPS } from './settingsScreenIds';

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

const commentItem = {
  id: 'i1',
  programId: 'p1',
  itemType: 'question' as const,
  title: '朝の質問',
  description: null,
  reason: null,
  responseType: 'comment' as const,
  isRequired: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ChallengeAdminTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canManageSpaceMock.mockReturnValue(true);
    listChallengeProgramsMock.mockResolvedValue([]);
    listChallengeItemsMock.mockResolvedValue([]);
    updateChallengeProgramMock.mockResolvedValue({ ok: true, value: makeProgram() });
    listManagerChallengeResponsesMock.mockResolvedValue([]);
    fetchSpaceMembershipNicknamesMock.mockResolvedValue(new Map());
    fetchParticipantAccountsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('uses 挑戦状の管理 as settings and page title', async () => {
    const nav = SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.id === 'challengeAdmin',
    );
    expect(nav?.label).toBe('挑戦状の管理');
    expect(nav?.description).toContain('作成・公開');
    expect(nav?.label).not.toBe('質問・ミッション管理');

    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText('挑戦状の管理')).toBeTruthy();
    expect(
      screen.getByText('参加者に届ける質問やミッションを作成・公開できます'),
    ).toBeTruthy();
    expect(screen.queryByText('質問・ミッション管理')).toBeNull();
  });

  it('shows empty state and create CTA for managers', async () => {
    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText('まだ挑戦状はありません')).toBeTruthy();
    expect(screen.getByText('最初の質問やミッションをつくってみましょう')).toBeTruthy();
    expect(screen.getByRole('button', { name: '挑戦状をつくる' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '新しい挑戦状をつくる' })).toBeTruthy();
  });

  it('lists draft and published programs with stats and CTAs', async () => {
    listChallengeProgramsMock.mockResolvedValue([
      makeProgram(),
      makeProgram({
        id: 'p2',
        title: '公開ストーリー',
        status: 'published',
        description: null,
      }),
    ]);
    listChallengeItemsMock.mockImplementation(async (programId: string) => {
      if (programId === 'p1') {
        return [
          commentItem,
          {
            ...commentItem,
            id: 'i2',
            isRequired: false,
            title: 'おまけ',
            sortOrder: 1,
          },
        ];
      }
      return [commentItem];
    });

    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText('下書きストーリー')).toBeTruthy();
    expect(screen.getByText('公開ストーリー')).toBeTruthy();
    expect(screen.getByText(/必須 1 ／ おまけ 1/)).toBeTruthy();
    expect(screen.getByText('説明なし')).toBeTruthy();
    expect(screen.getByRole('button', { name: '編集をつづける' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '内容・回答を見る' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '削除' })).toBeNull();
  });

  it('creates a draft program from the create form', async () => {
    const created = makeProgram({ id: 'p-new', title: '新規下書き', description: null });
    createChallengeProgramMock.mockResolvedValue({ ok: true, value: created });
    listChallengeProgramsMock.mockResolvedValue([]);
    listChallengeItemsMock.mockResolvedValue([]);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText(/まだ挑戦状はありません/);
    fireEvent.click(screen.getByRole('button', { name: '新しい挑戦状をつくる' }));
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
    expect(await screen.findByRole('button', { name: '下書きを保存' })).toBeTruthy();
  });

  it('confirms before deleting a draft program from danger zone', async () => {
    listChallengeProgramsMock.mockResolvedValue([makeProgram()]);
    listChallengeItemsMock.mockResolvedValue([]);
    deleteChallengeProgramMock.mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText('下書きストーリー');
    fireEvent.click(screen.getByRole('button', { name: '編集をつづける' }));
    fireEvent.click(await screen.findByRole('button', { name: 'この下書きを削除' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('下書きストーリー'));
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

  it('shows friendly list load errors with retry', async () => {
    listChallengeProgramsMock.mockRejectedValue(new Error('permission denied by RLS'));
    render(<ChallengeAdminTab space={space} />);
    expect(await screen.findByText('挑戦状を読み込めませんでした')).toBeTruthy();
    expect(screen.getByText('時間をおいて、もう一度お試しください')).toBeTruthy();
    expect(screen.queryByText(/permission denied by RLS/)).toBeNull();
    listChallengeProgramsMock.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }));
    await waitFor(() => {
      expect(listChallengeProgramsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('blocks publish with zero items and publishes after confirm', async () => {
    const program = makeProgram();
    listChallengeProgramsMock.mockResolvedValue([program]);
    listChallengeItemsMock.mockResolvedValue([]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText('下書きストーリー');
    fireEvent.click(screen.getByRole('button', { name: '編集をつづける' }));
    expect(await screen.findByRole('heading', { name: '参加者へ公開' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'この挑戦状を公開する' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    listChallengeItemsMock.mockResolvedValue([commentItem]);
    fireEvent.click(screen.getByRole('button', { name: '← 一覧へ戻る' }));
    await screen.findByText('下書きストーリー');
    listChallengeItemsMock.mockResolvedValue([commentItem]);
    fireEvent.click(screen.getByRole('button', { name: '編集をつづける' }));
    updateChallengeProgramStatusMock.mockResolvedValue({
      ok: true,
      value: { ...program, status: 'published' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'この挑戦状を公開する' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('変更できなくなります'));
    await waitFor(() => {
      expect(updateChallengeProgramStatusMock).toHaveBeenCalledWith('p1', 'published');
    });
    confirmSpy.mockRestore();
  });

  it('requires saving dirty title before publish', async () => {
    const program = makeProgram();
    listChallengeProgramsMock.mockResolvedValue([program]);
    listChallengeItemsMock.mockResolvedValue([commentItem]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText('下書きストーリー');
    fireEvent.click(screen.getByRole('button', { name: '編集をつづける' }));
    await screen.findByRole('button', { name: 'この挑戦状を公開する' });
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: '未保存タイトル' },
    });
    expect(
      (screen.getByRole('button', { name: 'この挑戦状を公開する' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(updateChallengeProgramStatusMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows published responses with visibility note and name fallback', async () => {
    const published = makeProgram({ status: 'published', title: '公開ストーリー' });
    listChallengeProgramsMock.mockResolvedValue([published]);
    listChallengeItemsMock.mockResolvedValue([commentItem]);
    listManagerChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-abcd-1234',
        visibility: 'manager_only',
        comment: '長い回答\n二行目',
        createdAt: new Date('2026-07-31T02:00:00.000Z'),
        updatedAt: new Date('2026-07-31T02:00:00.000Z'),
      },
    ]);
    fetchSpaceMembershipNicknamesMock.mockResolvedValue(new Map());
    fetchParticipantAccountsMock.mockResolvedValue([]);

    render(<ChallengeAdminTab space={space} />);
    await screen.findByText('公開ストーリー');
    fireEvent.click(screen.getByRole('button', { name: '内容・回答を見る' }));

    expect(
      await screen.findByText(/「自分だけに残す」を選んだ回答は、件数にも含まれません/),
    ).toBeTruthy();
    expect(screen.getAllByText('管理者にだけ共有').length).toBeGreaterThan(0);
    expect(await screen.findByText('参加者 user-abc')).toBeTruthy();
    expect(screen.getByText(/質問：朝の質問/)).toBeTruthy();
    expect(screen.getByText(/長い回答/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'この下書きを削除' })).toBeNull();
  });

  it('uses nickname when membership lookup resolves', async () => {
    const published = makeProgram({ status: 'published', title: '公開ストーリー' });
    listChallengeProgramsMock.mockResolvedValue([published]);
    listChallengeItemsMock.mockResolvedValue([commentItem]);
    listManagerChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: 'こんにちは',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    fetchSpaceMembershipNicknamesMock.mockResolvedValue(new Map([['user-1', 'みー']]));

    render(<ChallengeAdminTab space={space} />);
    fireEvent.click(await screen.findByRole('button', { name: '内容・回答を見る' }));
    expect(await screen.findByText('みー')).toBeTruthy();
  });

  it('shows empty shared-response state without claiming zero answers exist', async () => {
    const published = makeProgram({ status: 'published', title: '公開ストーリー' });
    listChallengeProgramsMock.mockResolvedValue([published]);
    listChallengeItemsMock.mockResolvedValue([commentItem]);
    listManagerChallengeResponsesMock.mockResolvedValue([]);

    render(<ChallengeAdminTab space={space} />);
    fireEvent.click(await screen.findByRole('button', { name: '内容・回答を見る' }));
    expect(
      await screen.findByText('管理者に共有された回答はまだありません'),
    ).toBeTruthy();
    expect(screen.queryByText(/回答自体が0件/)).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: '編集をつづける' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ミッションを追加' }));
    const formTitle = screen.getByText('項目を追加', { selector: 'p' });
    const form = formTitle.closest('div');
    expect(form).toBeTruthy();
    const textboxes = within(form as HTMLElement).getAllByRole('textbox');
    fireEvent.change(textboxes[0], {
      target: { value: '新しいミッション' },
    });
    fireEvent.click(within(form as HTMLElement).getByRole('button', { name: '項目を追加' }));

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
