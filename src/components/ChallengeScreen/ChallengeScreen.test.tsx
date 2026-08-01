// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

const {
  listPublishedChallengeProgramsMock,
  listPublishedChallengeItemsMock,
  listMyChallengeResponsesMock,
  listMyChallengeRewardsMock,
  listMyChallengeCompletionsMock,
  submitChallengeCommentResponseMock,
  deleteChallengeResponseMock,
  testStore,
} = vi.hoisted(() => ({
  listPublishedChallengeProgramsMock: vi.fn(),
  listPublishedChallengeItemsMock: vi.fn(),
  listMyChallengeResponsesMock: vi.fn(),
  listMyChallengeRewardsMock: vi.fn(),
  listMyChallengeCompletionsMock: vi.fn(),
  submitChallengeCommentResponseMock: vi.fn(),
  deleteChallengeResponseMock: vi.fn(),
  testStore: {
    currentUser: { uid: 'user-1', isAdmin: false } as {
      uid: string;
      isAdmin: boolean;
    } | null,
    activeSpaceId: 'dev-space-public',
    spaces: [{ id: 'dev-space-public', name: 'Dev Public' }] as Array<{
      id: string;
      name: string;
    }>,
    activeSpaceMembershipStatus: 'active' as
      | 'idle'
      | 'joining'
      | 'active'
      | 'none'
      | 'error',
  },
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: testStore.currentUser,
  }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: {
      activeSpaceId: testStore.activeSpaceId,
      spaces: testStore.spaces,
    },
    activeSpaceMembershipStatus: testStore.activeSpaceMembershipStatus,
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
  deleteChallengeResponse: (...args: unknown[]) => deleteChallengeResponseMock(...args),
}));

vi.mock('../../core/utils/challengeRewardsApi', () => ({
  listMyChallengeRewards: (...args: unknown[]) => listMyChallengeRewardsMock(...args),
  listMyChallengeCompletions: (...args: unknown[]) =>
    listMyChallengeCompletionsMock(...args),
  submitChallengeCommentResponse: (...args: unknown[]) =>
    submitChallengeCommentResponseMock(...args),
}));

import { ChallengeScreen } from './ChallengeScreen';

async function openRecordRecall(title: string) {
  const recordsToggle = await screen.findByRole('button', {
    name: /これまでの記録/,
  });
  if (recordsToggle.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(recordsToggle);
  }
  fireEvent.click(
    await screen.findByRole('button', { name: `${title}の記録を見る` }),
  );
  return screen.findByRole('dialog');
}

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

function resetTestStore() {
  testStore.currentUser = { uid: 'user-1', isAdmin: false };
  testStore.activeSpaceId = 'dev-space-public';
  testStore.spaces = [{ id: 'dev-space-public', name: 'Dev Public' }];
  testStore.activeSpaceMembershipStatus = 'active';
}

describe('ChallengeScreen rewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTestStore();
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
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答本文' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: '挑戦状コンプリート！' })).toBeTruthy();
    expect(within(dialog).getByText('1 / 1 完了')).toBeTruthy();
    expect(within(dialog).getByText(/質問1/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '回答を振り返る' })).toBeTruthy();
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
    // Single required item is complete → list CTA is「開く」
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    const dialog = await openRecordRecall('質問1');
    fireEvent.click(within(dialog).getByRole('button', { name: /の回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '書き直す' }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '更新後' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を更新/ }));

    await waitFor(() => {
      expect(submitChallengeCommentResponseMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole('heading', { name: 'Hossiiをゲット！' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '挑戦状コンプリート！' })).toBeNull();
    expect(await screen.findByText('回答を更新しました')).toBeTruthy();
  });

  it('keeps input and shows error when RPC fails', async () => {
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: false,
      error: '権限がありません',
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '残すべき入力' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));

    expect(await screen.findByText('この回答を保存する権限がありません')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('残すべき入力');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ChallengeScreen list UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTestStore();
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
    expect(screen.getByText('まだこれから')).toBeTruthy();
    expect(screen.getByText('0 / 2 達成')).toBeTruthy();
    expect(screen.getByText('最初の挑戦から始めてみよう')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: '公開ストーリーの進捗：0 / 2 達成' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '「公開ストーリー」を開く' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /挑戦する|つづける|振り返る/ })).toBeNull();
  });

  it('shows open CTA for partial progress with in-progress badge', async () => {
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
    expect(await screen.findByText('挑戦中')).toBeTruthy();
    expect(screen.getByText('1 / 2 達成')).toBeTruthy();
    expect(screen.getByText('あと1つ')).toBeTruthy();
    expect(screen.getByRole('button', { name: '「公開ストーリー」を開く' })).toBeTruthy();
  });

  it('shows cleared badge when required items are done with leftovers', async () => {
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
    expect(screen.queryByText('コンプリート')).toBeNull();
    expect(screen.getByText('必須 1 / 1 達成')).toBeTruthy();
    expect(screen.getByText('おまけがあと1つあります')).toBeTruthy();
    expect(screen.getByRole('button', { name: '「公開ストーリー」を開く' })).toBeTruthy();
  });

  it('shows complete badge when all items are done', async () => {
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
    expect(await screen.findByText('コンプリート')).toBeTruthy();
    expect(screen.queryByText('クリア済み')).toBeNull();
    expect(screen.getByText('2 / 2 達成')).toBeTruthy();
    expect(screen.getByText('すべての挑戦を達成しました')).toBeTruthy();
    expect(screen.getByRole('button', { name: '「公開ストーリー」を開く' })).toBeTruthy();
  });

  it('keeps progress from completions even when responses are deleted', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: '質問2', sortOrder: 1 },
    ]);
    listMyChallengeResponsesMock.mockResolvedValue([]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: null,
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: 'c2',
        itemId: 'i2',
        userId: 'user-1',
        responseId: null,
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    render(<ChallengeScreen />);
    expect(await screen.findByText('コンプリート')).toBeTruthy();
    expect(screen.getByText('2 / 2 達成')).toBeTruthy();
  });

  it('shows preparing state when published program has zero items', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([]);

    render(<ChallengeScreen />);
    expect(await screen.findByText('準備中')).toBeTruthy();
    expect(screen.getByText('まだ挑戦できる項目がありません')).toBeTruthy();
    expect(screen.queryByText('クリア済み')).toBeNull();
    expect(screen.queryByText('コンプリート')).toBeNull();
    expect(screen.getByRole('button', { name: '「公開ストーリー」を開く' })).toBeTruthy();
  });

  it('shows empty state when there are no published programs', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([]);
    render(<ChallengeScreen />);
    expect(
      await screen.findByText('いま挑戦できる挑戦状はありません'),
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
    expect(await screen.findByRole('button', { name: /開く/ })).toBeTruthy();
  });

  it('omits empty description block', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([
      { ...publishedProgram, description: null },
    ]);
    const { container } = render(<ChallengeScreen />);
    await screen.findByRole('button', { name: /開く/ });
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
    resetTestStore();
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
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    expect(await screen.findByRole('heading', { name: '次の挑戦' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByDisplayValue('')).toBeTruthy();
    expect(screen.getByLabelText('管理者にだけ共有')).toBeTruthy();
    expect(screen.getAllByText('クリアに必要').length).toBeGreaterThan(0);
    expect(screen.getByText(/「管理者にだけ共有」を選ぶと/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '挑戦の記録' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'これから答える' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '回答済み' })).toBeNull();
  });

  it('places compact progress and next challenge before stamp details', async () => {
    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });

    const progress = screen.getByLabelText(/挑戦状の進捗/);
    const focus = screen.getByRole('heading', { name: '次の挑戦' });
    const stamps = screen.getByLabelText('Hossiiスタンプカード');
    const trajectory = screen.getByRole('button', { name: '挑戦の記録' });

    expect(progress.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(focus.compareDocumentPosition(stamps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stamps.compareDocumentPosition(trajectory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(progress).getByText('あと2つでクリア')).toBeTruthy();
    expect(screen.getByText('スタンプを押して、思い出をひらこう')).toBeTruthy();
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
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    expect(await screen.findByRole('heading', { name: 'おまけの挑戦' })).toBeTruthy();
    expect(screen.getByText(/必須クリア/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '完成した軌跡を見る' })).toBeNull();
    expect(screen.getByRole('button', { name: '挑戦の記録' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '挑戦の記録' }));
    expect(await screen.findByLabelText('挑戦の記録')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '公開ストーリー' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '← 挑戦状へ戻る' }));
    expect(await screen.findByRole('heading', { name: 'おまけの挑戦' })).toBeTruthy();
  });

  it('keeps answered records collapsed until opened', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });
    expect(screen.queryByText('秘密の回答')).toBeNull();
    expect(screen.getByRole('button', { name: /これまでの記録 1件/ })).toBeTruthy();
    const dialog = await openRecordRecall('質問1');
    expect(within(dialog).getByText('秘密の回答')).toBeTruthy();
    expect(within(dialog).getByText('自分だけに残す')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /の回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '書き直す' }));
    expect(await screen.findByRole('textbox')).toBeTruthy();
    expect(
      (screen.getByLabelText('自分だけに残す') as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('rewrites from action menu without reward modal', async () => {
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '初回の回答',
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
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r1',
          itemId: 'i1',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '書き直し後',
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
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    const rewriteDialog = await openRecordRecall('質問1');
    fireEvent.click(within(rewriteDialog).getByRole('button', { name: /の回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '書き直す' }));
    expect(await screen.findByRole('textbox')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      '初回の回答',
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '書き直し後' },
    });
    fireEvent.click(screen.getByRole('button', { name: /回答を更新/ }));
    expect(await screen.findByText('回答を更新しました')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hossiiをゲット！' })).toBeNull();
  });

  it('deletes response while keeping completion reward and list progress', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: '質問2', sortOrder: 1 },
    ]);
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '削除される回答',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'r2',
        itemId: 'i2',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '残る回答',
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
      {
        id: 'rw2',
        completionId: 'c2',
        userId: 'user-1',
        itemId: 'i2',
        hossiiKey: 'emotion/kirakira',
        awardedAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    deleteChallengeResponseMock.mockResolvedValue({ ok: true });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    expect(await screen.findByRole('button', { name: /これまでの記録 2件/ })).toBeTruthy();
    const deleteDialog = await openRecordRecall('質問1');
    expect(within(deleteDialog).getByText('削除される回答')).toBeTruthy();
    fireEvent.click(
      within(deleteDialog).getByRole('button', {
        name: '「質問1」の回答操作',
      }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: '回答を削除' }));
    expect(
      screen.getByText('「質問1」への回答を削除しますか？'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '回答を削除' }));

    expect(await screen.findByText('回答を削除しました')).toBeTruthy();
    expect(deleteChallengeResponseMock).toHaveBeenCalledWith('r1');
    expect(screen.queryByText('削除される回答')).toBeNull();
    expect(screen.getByText('スタンプ獲得済み')).toBeTruthy();
    expect(screen.getByRole('button', { name: /これまでの記録 2件/ })).toBeTruthy();
    expect(screen.getByLabelText('Hossiiスタンプカード')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hossiiをゲット！' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '← 一覧へ戻る' }));
    expect(await screen.findByText('コンプリート')).toBeTruthy();
    expect(screen.getByText('2 / 2 達成')).toBeTruthy();
  });

  it('keeps answered record when delete API fails', async () => {
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '残すべき回答',
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
    deleteChallengeResponseMock.mockResolvedValue({
      ok: false,
      error: 'permission denied by rls',
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    const failDialog = await openRecordRecall('質問1');
    fireEvent.click(
      within(failDialog).getByRole('button', { name: /の回答操作/ }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: '回答を削除' }));
    fireEvent.click(screen.getByRole('button', { name: '回答を削除' }));
    expect(
      await screen.findByText('この回答を削除する権限がありません'),
    ).toBeTruthy();
    expect(within(failDialog).getByText('残すべき回答')).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('opens recall modal from stamp and excerpt, and supports deleted answer again', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: '質問2', sortOrder: 1 },
    ]);
    listMyChallengeResponsesMock.mockResolvedValue([
      {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '回想の回答',
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
    deleteChallengeResponseMock.mockResolvedValue({ ok: true });
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r1b',
          itemId: 'i1',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '再回答',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        completion: {
          id: 'c1',
          itemId: 'i1',
          userId: 'user-1',
          responseId: 'r1b',
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
        wasInsert: true,
      },
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: /質問1のスタンプを振り返る/ }),
    );
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('回想の回答')).toBeTruthy();
    expect(within(dialog).getByText('管理者にだけ共有')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '閉じる' }));

    dialog = await openRecordRecall('質問1');
    expect(within(dialog).getByRole('button', { name: /の回答操作/ })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '閉じる' }));

    dialog = await openRecordRecall('質問1');
    fireEvent.click(
      within(dialog).getByRole('button', { name: '「質問1」の回答操作' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: '回答を削除' }));
    fireEvent.click(screen.getByRole('button', { name: '回答を削除' }));
    expect(await screen.findByText('回答を削除しました')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /質問1のスタンプを振り返る/ }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/回答は削除済みです/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /の回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'もう一度答える' }));
    expect(await screen.findByRole('textbox')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '再回答' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));
    expect(await screen.findByText('回答を保存しました')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hossiiをゲット！' })).toBeNull();
  });

  it('opens pending stamp into answer form and closes recall with Escape', async () => {
    listPublishedChallengeItemsMock.mockResolvedValue([
      commentItem,
      { ...commentItem, id: 'i2', title: '質問2', sortOrder: 1 },
    ]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: null,
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]);
    listMyChallengeRewardsMock.mockResolvedValue([]);

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: /質問1のスタンプを振り返る/ }),
    );
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/回答は削除済みです/)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /質問2に答える/ }));
    expect(await screen.findByRole('textbox')).toBeTruthy();
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
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答本文' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));
    expect(await screen.findByRole('heading', { name: 'Hossiiをゲット！' })).toBeTruthy();
    expect(screen.getByText('必須 1 / 2')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'つづける' }),
    );
    expect(await screen.findByRole('heading', { name: '次の挑戦' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: '質問2' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('opens records page after clear celebration when required items finish', async () => {
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
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r2',
          itemId: 'i2',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '回答2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        completion: {
          id: 'c2',
          itemId: 'i2',
          userId: 'user-1',
          responseId: 'r2',
          completedAt: new Date(),
          createdAt: new Date(),
        },
        reward: {
          id: 'rw2',
          completionId: 'c2',
          userId: 'user-1',
          itemId: 'i2',
          hossiiKey: 'idle/idle_smile',
          awardedAt: new Date(),
          createdAt: new Date(),
        },
        isNewReward: true,
        wasInsert: true,
      },
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答2' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));

    const clearDialog = await screen.findByRole('dialog');
    expect(within(clearDialog).getByRole('heading', { name: '挑戦状クリア！' })).toBeTruthy();
    expect(within(clearDialog).getByText('必須 2 / 2 達成')).toBeTruthy();
    expect(within(clearDialog).getByText('おまけの挑戦があと1つあります')).toBeTruthy();
    fireEvent.click(
      within(clearDialog).getByRole('button', {
        name: 'おまけに挑戦する',
      }),
    );
    expect(await screen.findByLabelText('挑戦の記録')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '公開ストーリー' })).toBeTruthy();
  });

  it('does not show reward modal when re-answering without new reward', async () => {
    listMyChallengeResponsesMock.mockResolvedValue([]);
    listMyChallengeCompletionsMock.mockResolvedValue([
      {
        id: 'c1',
        itemId: 'i1',
        userId: 'user-1',
        responseId: null,
        completedAt: new Date(),
        createdAt: new Date(),
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
    submitChallengeCommentResponseMock.mockResolvedValue({
      ok: true,
      value: {
        response: {
          id: 'r1',
          itemId: 'i1',
          userId: 'user-1',
          visibility: 'manager_only',
          comment: '再回答',
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
        wasInsert: true,
      },
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /開く/ }));
    await screen.findByRole('heading', { name: '次の挑戦' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '再回答' } });
    fireEvent.click(screen.getByRole('button', { name: /回答を保存/ }));
    expect(await screen.findByText('回答を保存しました')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ChallengeScreen list loading races', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTestStore();
    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);
    listPublishedChallengeItemsMock.mockResolvedValue([commentItem]);
    listMyChallengeResponsesMock.mockResolvedValue([]);
    listMyChallengeRewardsMock.mockResolvedValue([]);
    listMyChallengeCompletionsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not treat membership waiting as formal empty', async () => {
    testStore.activeSpaceMembershipStatus = 'joining';
    listPublishedChallengeProgramsMock.mockResolvedValue([]);

    render(<ChallengeScreen />);
    expect(await screen.findByText('挑戦状を準備しています…')).toBeTruthy();
    expect(
      screen.queryByText('いま挑戦できる挑戦状はありません'),
    ).toBeNull();
    expect(listPublishedChallengeProgramsMock).not.toHaveBeenCalled();
  });

  it('starts fetch when membership becomes active after joining', async () => {
    testStore.activeSpaceMembershipStatus = 'joining';
    const { rerender } = render(<ChallengeScreen />);
    expect(await screen.findByText('挑戦状を準備しています…')).toBeTruthy();
    expect(listPublishedChallengeProgramsMock).not.toHaveBeenCalled();

    testStore.activeSpaceMembershipStatus = 'active';
    rerender(<ChallengeScreen />);
    expect(await screen.findByRole('button', { name: /開く/ })).toBeTruthy();
    expect(listPublishedChallengeProgramsMock).toHaveBeenCalled();
  });

  it('does not fetch when access is denied', async () => {
    testStore.activeSpaceMembershipStatus = 'none';
    render(<ChallengeScreen />);
    expect(
      await screen.findByText('このスペースの参加者のみ挑戦状に回答できます。'),
    ).toBeTruthy();
    expect(listPublishedChallengeProgramsMock).not.toHaveBeenCalled();
  });

  it('shows empty only after active membership and zero published programs', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([]);
    render(<ChallengeScreen />);
    expect(
      await screen.findByText('いま挑戦できる挑戦状はありません'),
    ).toBeTruthy();
  });

  it('does not refetch when only activeSpace object identity changes', async () => {
    const { rerender } = render(<ChallengeScreen />);
    expect(await screen.findByRole('button', { name: /開く/ })).toBeTruthy();
    const callsAfterFirst = listPublishedChallengeProgramsMock.mock.calls.length;

    testStore.spaces = [{ id: 'dev-space-public', name: 'Dev Public Renamed' }];
    rerender(<ChallengeScreen />);
    await act(async () => {});
    expect(listPublishedChallengeProgramsMock.mock.calls.length).toBe(callsAfterFirst);
    expect(screen.getByRole('button', { name: /開く/ })).toBeTruthy();
    expect(screen.queryByText('挑戦状をひろっています…')).toBeNull();
  });

  it('refetches when space id changes and does not keep previous list', async () => {
    const otherProgram = {
      ...publishedProgram,
      id: 'p2',
      spaceId: 'space-b',
      title: '別スペースの挑戦状',
    };
    listPublishedChallengeProgramsMock.mockImplementation(async (id: string) => {
      if (id === 'space-b') return [otherProgram];
      return [publishedProgram];
    });

    const { rerender } = render(<ChallengeScreen />);
    expect(await screen.findByText('公開ストーリー')).toBeTruthy();

    testStore.activeSpaceId = 'space-b';
    testStore.spaces = [{ id: 'space-b', name: 'Space B' }];
    rerender(<ChallengeScreen />);

    expect(await screen.findByText('別スペースの挑戦状')).toBeTruthy();
    expect(screen.queryByText('公開ストーリー')).toBeNull();
  });

  it('ignores a stale slower request from a previous space', async () => {
    let resolveSpaceA: (value: unknown[]) => void = () => {};
    const spaceAPending = new Promise<unknown[]>((resolve) => {
      resolveSpaceA = resolve;
    });
    listPublishedChallengeProgramsMock.mockImplementation((id: string) => {
      if (id === 'dev-space-public') return spaceAPending;
      return Promise.resolve([
        {
          ...publishedProgram,
          id: 'p2',
          spaceId: 'space-b',
          title: '別スペースの挑戦状',
        },
      ]);
    });

    const { rerender } = render(<ChallengeScreen />);
    expect(await screen.findByText('挑戦状をひろっています…')).toBeTruthy();

    testStore.activeSpaceId = 'space-b';
    testStore.spaces = [{ id: 'space-b', name: 'Space B' }];
    rerender(<ChallengeScreen />);
    expect(await screen.findByText('別スペースの挑戦状')).toBeTruthy();

    await act(async () => {
      resolveSpaceA([publishedProgram]);
    });
    expect(screen.queryByText('公開ストーリー')).toBeNull();
    expect(screen.getByText('別スペースの挑戦状')).toBeTruthy();
  });

  it('ignores stale error from an older request', async () => {
    let rejectSpaceA: (error: Error) => void = () => {};
    const spaceAPending = new Promise<unknown[]>((_, reject) => {
      rejectSpaceA = reject;
    });
    listPublishedChallengeProgramsMock.mockImplementation((id: string) => {
      if (id === 'dev-space-public') return spaceAPending;
      return Promise.resolve([
        {
          ...publishedProgram,
          id: 'p2',
          spaceId: 'space-b',
          title: '別スペースの挑戦状',
        },
      ]);
    });

    const { rerender } = render(<ChallengeScreen />);
    await screen.findByText('挑戦状をひろっています…');

    testStore.activeSpaceId = 'space-b';
    testStore.spaces = [{ id: 'space-b', name: 'Space B' }];
    rerender(<ChallengeScreen />);
    expect(await screen.findByText('別スペースの挑戦状')).toBeTruthy();

    await act(async () => {
      rejectSpaceA(new Error('old failure'));
    });
    expect(screen.queryByText('挑戦状を読み込めませんでした')).toBeNull();
    expect(screen.getByText('別スペースの挑戦状')).toBeTruthy();
  });

  it('keeps existing list visible while refreshing', async () => {
    let resolveRefresh: (value: unknown[]) => void = () => {};
    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);

    render(<ChallengeScreen />);
    expect(await screen.findByRole('button', { name: /開く/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /開く/ }));
    await screen.findByRole('heading', { level: 1, name: '公開ストーリー' });

    listPublishedChallengeProgramsMock.mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: '← 一覧へ戻る' }));

    expect(await screen.findByText('最新の挑戦状を確認しています…')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '公開ストーリー' })).toBeTruthy();
    expect(screen.queryByText('挑戦状をひろっています…')).toBeNull();

    await act(async () => {
      resolveRefresh([publishedProgram]);
    });
    await waitFor(() => {
      expect(screen.queryByText('最新の挑戦状を確認しています…')).toBeNull();
    });
  });

  it('retries after error and ignores the previous in-flight failure', async () => {
    let rejectFirst: (error: Error) => void = () => {};
    listPublishedChallengeProgramsMock.mockImplementationOnce(
      () =>
        new Promise<unknown[]>((_, reject) => {
          rejectFirst = reject;
        }),
    );

    render(<ChallengeScreen />);
    expect(await screen.findByText('挑戦状をひろっています…')).toBeTruthy();

    listPublishedChallengeProgramsMock.mockResolvedValue([publishedProgram]);
    // Force the pending first request to fail after retry is available via error UI path:
    // complete first as failure, then retry.
    await act(async () => {
      rejectFirst(new Error('network'));
    });
    expect(await screen.findByText('挑戦状を読み込めませんでした')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }));
    expect(await screen.findByRole('button', { name: /開く/ })).toBeTruthy();
  });

  it('does not update state after unmount', async () => {
    let resolvePrograms: (value: unknown[]) => void = () => {};
    listPublishedChallengeProgramsMock.mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolvePrograms = resolve;
        }),
    );

    const { unmount } = render(<ChallengeScreen />);
    expect(await screen.findByText('挑戦状をひろっています…')).toBeTruthy();
    unmount();

    await act(async () => {
      resolvePrograms([publishedProgram]);
    });
    expect(screen.queryByText('公開ストーリー')).toBeNull();
  });
});
