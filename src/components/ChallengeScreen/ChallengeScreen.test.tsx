// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    fireEvent.click(await screen.findByRole('button', { name: '挑戦する' }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答本文' } });
    fireEvent.click(screen.getByRole('button', { name: '回答を保存' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'つづける' }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '更新後' } });
    fireEvent.click(screen.getByRole('button', { name: '回答を更新' }));

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
    fireEvent.click(await screen.findByRole('button', { name: '挑戦する' }));
    await screen.findByRole('textbox');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '残すべき入力' } });
    fireEvent.click(screen.getByRole('button', { name: '回答を保存' }));

    expect(await screen.findByText('権限がありません')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('残すべき入力');
    expect(screen.queryByText('Hossiiゲット！')).toBeNull();
  });
});
