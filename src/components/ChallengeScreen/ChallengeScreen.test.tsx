// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const {
  listPublishedChallengeProgramsMock,
  listPublishedChallengeItemsMock,
  listMyChallengeResponsesMock,
  listMyChallengeRewardsMock,
  listMyChallengeCompletionsMock,
  submitChallengeCommentResponseMock,
} = vi.hoisted(() => ({
  listPublishedChallengeProgramsMock: vi.fn(),
  listPublishedChallengeItemsMock: vi.fn(),
  listMyChallengeResponsesMock: vi.fn(),
  listMyChallengeRewardsMock: vi.fn(),
  listMyChallengeCompletionsMock: vi.fn(),
  submitChallengeCommentResponseMock: vi.fn(),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1', isAdmin: false },
  }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: {
      activeSpaceId: 'dev-space-public',
      spaces: [{ id: 'dev-space-public', name: 'Dev Public' }],
    },
    activeSpaceMembershipStatus: 'active',
  }),
}));

vi.mock('../Navigation/TopRightMenu', () => ({
  TopRightMenu: () => <div data-testid="top-right-menu" />,
}));

vi.mock('../../core/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

vi.mock('../../core/utils/challengeResponsesApi', () => ({
  listPublishedChallengePrograms: (...args: unknown[]) =>
    listPublishedChallengeProgramsMock(...args),
  listPublishedChallengeItems: (...args: unknown[]) =>
    listPublishedChallengeItemsMock(...args),
  listMyChallengeResponses: (...args: unknown[]) => listMyChallengeResponsesMock(...args),
}));

vi.mock('../../core/utils/challengeRewardsApi', () => ({
  listMyChallengeRewards: (...args: unknown[]) => listMyChallengeRewardsMock(...args),
  listMyChallengeCompletions: (...args: unknown[]) =>
    listMyChallengeCompletionsMock(...args),
  submitChallengeCommentResponse: (...args: unknown[]) =>
    submitChallengeCommentResponseMock(...args),
}));

import { ChallengeScreen } from './ChallengeScreen';

const publishedProgram = {
  id: 'p1',
  spaceId: 'dev-space-public',
  title: '公開ストーリー',
  description: null,
  status: 'published' as const,
  createdBy: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const commentItem = {
  id: 'i1',
  programId: 'p1',
  itemType: 'question' as const,
  title: '質問1',
  description: null,
  reason: null,
  responseType: 'comment' as const,
  isRequired: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ChallengeScreen rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);
    listPublishedChallengeItemsMock.mockResolvedValue([commentItem]);
    listMyChallengeResponsesMock.mockResolvedValue([]);
    listMyChallengeRewardsMock.mockResolvedValue([]);
    listMyChallengeCompletionsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows reward modal only on first award', async () => {
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r1',
          itemId: 'i1',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '回答本文',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        completion: {
          id: 'c1',
          itemId: 'i1',
          userId: 'user-1',
          responseId: 'r1',
          completedAt: new Date(),
          createdAt: new Date(),
        },
        reward: {
          id: 'rw1',
          completionId: 'c1',
          userId: 'user-1',
          itemId: 'i1',
          hossiiKey: 'emotion/wow',
          awardedAt: new Date(),
          createdAt: new Date(),
        },
        isNewReward: true,
        wasInsert: true,
      },
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /挑戦する/ }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答本文' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));

    expect(await screen.findByText('Hossiiゲット！')).toBeTruthy();
    expect(screen.getByText('新しいHossiiが仲間になりました')).toBeTruthy();
    expect(submitChallengeCommentResponseMock).toHaveBeenCalledWith({
      itemId: 'i1',
      comment: '回答本文',
      visibility: 'manager_only',
    });
  });

  it('does not show reward modal on update without new reward', async () => {
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '旧回答',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    listMyChallengeRewardsMock.mockResolvedValue([
      {
        id: 'rw1',
        completionId: 'c1',
        userId: 'user-1',
        itemId: 'i1',
        hossiiKey: 'emotion/wow',
        awardedAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: 'r1',
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r1',
          itemId: 'i1',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '更新後',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        completion: {
          id: 'c1',
          itemId: 'i1',
          userId: 'user-1',
          responseId: 'r1',
          completedAt: new Date(),
          createdAt: new Date(),
        },
        reward: {
          id: 'rw1',
          completionId: 'c1',
          userId: 'user-1',
          itemId: 'i1',
          hossiiKey: 'emotion/wow',
          awardedAt: new Date(),
          createdAt: new Date(),
        },
        isNewReward: false,
        wasInsert: false,
      },
    });

    render(<ChallengeScreen />);
    // Single required item is complete → list CTA is「振り返る」
    fireEvent.click(await screen.findByRole('button', { name: /振り返る/ }));
    fireEvent.click(await screen.findByRole('button', { name: /回答を見る・書き直す/ }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '更新後' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を更新/ }));

    await waitFor(() => {
      expect(submitChallengeCommentResponseMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Hossiiゲット！')).toBeNull();
    expect(await screen.findByText('回答を更新しました')).toBeTruthy();
  });

  it('keeps input and shows error when RPC fails', async () => {
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: false,
      error: '権限がありません',
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /挑戦する/ }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '残すべき入力' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));

    expect(await screen.findByText('この回答を保存する権限がありません')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('残すべき入力');
    expect(screen.queryByText('Hossiiゲット！')).toBeNull();
  });
});

describe('ChallengeScreen list UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);
    listPublishedChallengeItemsMock.mockResolvedValue([commentItem]);
    listMyChallengeResponsesMock.mockResolvedValue([]);
    listMyChallengeRewardsMock.mockResolvedValue([]);
    listMyChallengeCompletionsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows participant intro without MVP developer note', async () => {
    render(<ChallengeScreen />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hossiiからの挑戦状' }),
    ).toBeTruthy();
    expect(screen.getByText('コメントで答えて、Hossiiを集めよう')).toBeTruthy();
    expect(screen.queryByText(/全体ON\/OFF/)).toBeNull();
    expect(screen.queryByText('公開中')).toBeNull();
  });

  it('clamps long description and shows not-started progress', async () => {
    const longDescription = 'あ'.repeat(120);
    listPublishedChallengeProgramsMock.mockResolvedValue([
      { ...publishedProgram, description: longDescription },
    ]);
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: '質問2', sortOrder: 1 },
    ]);

    render(<ChallengeScreen />);
    expect(await screen.findByText(longDescription)).toBeTruthy();
    expect(screen.getByText('0 / 2 達成')).toBeTruthy();
    expect(screen.getByText('全2問')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: '公開ストーリーの進捗：0 / 2 達成' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '挑戦する：公開ストーリー' })).toBeTruthy();
  });

  it('shows continue CTA for partial progress', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: '質問2', sortOrder: 1 },
    ]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: 'r1',
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    render(<ChallengeScreen />);
    expect(await screen.findByText('1 / 2 達成')).toBeTruthy();
    expect(screen.getByText('あと1つ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つづける：公開ストーリー' })).toBeTruthy();
  });

  it('shows clear state and review CTA when required items are done', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: 'おまけ', isRequired: false, sortOrder: 1 },
    ]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: 'r1',
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    render(<ChallengeScreen />);
    expect(await screen.findByText('クリア済み')).toBeTruthy();
    expect(screen.getByText('1 / 2 達成')).toBeTruthy();
    expect(screen.getByRole('button', { name: '振り返る：公開ストーリー' })).toBeTruthy();
  });

  it('shows empty state when there are no published programs', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([]);
    render(<ChallengeScreen />);
    expect(
      await screen.findByText('いま挑戦できるストーリーはありません'),
    ).toBeTruthy();
    expect(
      screen.getByText('新しい挑戦状が届くまで、少し待っていてね'),
    ).toBeTruthy();
  });

  it('shows friendly error and retries', async () => {
    listPublishedChallengeProgramsMock.mockRejectedValue(
      new Error('relation "challenge_programs" does not exist'),
    );

    render(<ChallengeScreen />);
    expect(await screen.findByText('挑戦状を読み込めませんでした')).toBeTruthy();
    expect(screen.getByText('時間をおいて、もう一度試してください')).toBeTruthy();
    expect(screen.queryByText(/challenge_programs/)).toBeNull();

    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);
    fireEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }));
    expect(await screen.findByRole('button', { name: /挑戦する/ })).toBeTruthy();
  });

  it('omits empty description block', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([
      { ...publishedProgram, description: null },
    ]);
    const { container } = render(<ChallengeScreen />);
    await screen.findByRole('button', { name: /挑戦する/ });
    expect(container.querySelector('[class*="programDescription"]')).toBeNull();
  });
});

describe('ChallengeScreen focused response UI', () => {
  const item2 = {
    ...commentItem,
    id: 'i2',
    title: '質問2',
    sortOrder: 1,
  };
  const optionalItem = {
    ...commentItem,
    id: 'i3',
    title: 'おまけ質問',
    isRequired: false,
    sortOrder: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);
    listPublishedChallengeItemsMock.mockResolvedValue([commentItem, item2, optionalItem]);
    listMyChallengeResponsesMock.mockResolvedValue([]);
    listMyChallengeRewardsMock.mockResolvedValue([]);
    listMyChallengeCompletionsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('emphasizes the first unanswered required item', async () => {
    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /挑戦する/ }));
    expect(await screen.findByRole('heading', { name: '次の挑戦' })).toBeTruthy();
    expect(screen.getByText('まずはこの質問に答えてみよう')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByDisplayValue('')).toBeTruthy();
    expect(screen.getByLabelText('管理者にだけ共有')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /この質問に答える/ })).toHaveLength(2);
  });

  it('moves focus to optional after required items are answered', async () => {
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '回答1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'r2',
        itemId: 'i2',
        userId: 'user-1',
        visibility: 'self_only',
        comment: '回答2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: 'r1',
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: 'c2',
        itemId: 'i2',
        userId: 'user-1',
        responseId: 'r2',
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /振り返る|つづける/ }));
    expect(await screen.findByRole('heading', { name: 'おまけの挑戦' })).toBeTruthy();
    expect(screen.getByText('もっとHossiiを集めたい人へ')).toBeTruthy();
    expect(screen.getByText('必須の挑戦はクリアしました')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('keeps answered items collapsed until expanded', async () => {
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'self_only',
        comment: '秘密の回答',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: 'r1',
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /つづける/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });
    expect(screen.queryByText('秘密の回答')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /回答を見る・書き直す/ }));
    expect(await screen.findByText('秘密の回答')).toBeTruthy();
    expect(
      (screen.getByLabelText('自分だけに残す') as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('advances focus after closing reward modal', async () => {
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r1',
          itemId: 'i1',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '回答本文',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        completion: {
          id: 'c1',
          itemId: 'i1',
          userId: 'user-1',
          responseId: 'r1',
          completedAt: new Date(),
          createdAt: new Date(),
        },
        reward: {
          id: 'rw1',
          completionId: 'c1',
          userId: 'user-1',
          itemId: 'i1',
          hossiiKey: 'emotion/wow',
          awardedAt: new Date(),
          createdAt: new Date(),
        },
        isNewReward: true,
        wasInsert: true,
      },
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /挑戦する/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答本文' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));
    expect(await screen.findByText('Hossiiゲット！')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '閉じる' }),
    );
    expect(await screen.findByRole('heading', { name: '次の挑戦' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: '質問2' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
