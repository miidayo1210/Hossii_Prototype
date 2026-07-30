// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  listPublishedChallengeProgramsMock,
  listPublishedChallengeItemsMock,
  listMyChallengeResponsesMock,
  createChallengeResponseMock,
  updateChallengeResponseMock,
  getMyChallengeResponseMock,
} = vi.hoisted(() => ({
  listPublishedChallengeProgramsMock: vi.fn(),
  listPublishedChallengeItemsMock: vi.fn(),
  listMyChallengeResponsesMock: vi.fn(),
  createChallengeResponseMock: vi.fn(),
  updateChallengeResponseMock: vi.fn(),
  getMyChallengeResponseMock: vi.fn(),
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

vi.mock('../../core/utils/challengeResponsesApi', () => ({
  listPublishedChallengePrograms: (...args: unknown[]) =>
    listPublishedChallengeProgramsMock(...args),
  listPublishedChallengeItems: (...args: unknown[]) =>
    listPublishedChallengeItemsMock(...args),
  listMyChallengeResponses: (...args: unknown[]) => listMyChallengeResponsesMock(...args),
  createChallengeResponse: (...args: unknown[]) => createChallengeResponseMock(...args),
  updateChallengeResponse: (...args: unknown[]) => updateChallengeResponseMock(...args),
  getMyChallengeResponse: (...args: unknown[]) => getMyChallengeResponseMock(...args),
}));

import { ChallengeScreen } from './ChallengeScreen';

describe('ChallengeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPublishedChallengeProgramsMock.mockResolvedValue([]);
    listPublishedChallengeItemsMock.mockResolvedValue([]);
    listMyChallengeResponsesMock.mockResolvedValue([]);
    getMyChallengeResponseMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows empty state when no published programs', async () => {
    render(<ChallengeScreen />);
    expect(await screen.findByText(/いま公開中の挑戦状はありません/)).toBeTruthy();
  });

  it('lists published programs and opens detail', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([
      {
        id: 'p1',
        spaceId: 'dev-space-public',
        title: '公開ストーリー',
        description: '説明です',
        status: 'published',
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    listPublishedChallengeItemsMock.mockResolvedValue([
      {
        id: 'i1',
        programId: 'p1',
        itemType: 'question',
        title: '質問1',
        description: null,
        reason: null,
        responseType: 'comment',
        isRequired: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    render(<ChallengeScreen />);
    expect(await screen.findByText('公開ストーリー')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '挑戦する' }));
    expect(await screen.findByText('質問1')).toBeTruthy();
    expect(screen.getByText(/あなたとスペース管理者だけ/)).toBeTruthy();
  });

  it('creates a comment response with manager_only default', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([
      {
        id: 'p1',
        spaceId: 'dev-space-public',
        title: '公開ストーリー',
        description: null,
        status: 'published',
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    listPublishedChallengeItemsMock.mockResolvedValue([
      {
        id: 'i1',
        programId: 'p1',
        itemType: 'mission',
        title: 'ミッション1',
        description: null,
        reason: null,
        responseType: 'comment',
        isRequired: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    createChallengeResponseMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'r1',
        itemId: 'i1',
        userId: 'user-1',
        visibility: 'manager_only',
        comment: '回答本文',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    render(<ChallengeScreen />);
    fireEvent.click(await screen.findByRole('button', { name: '挑戦する' }));
    await screen.findByText('ミッション1');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '回答本文' } });
    fireEvent.click(screen.getByRole('button', { name: '回答を保存' }));

    await waitFor(() => {
      expect(createChallengeResponseMock).toHaveBeenCalledWith({
        itemId: 'i1',
        comment: '回答本文',
        visibility: 'manager_only',
      });
    });
  });

  it('shows load errors without clearing draft input path', async () => {
    listPublishedChallengeProgramsMock.mockRejectedValue(new Error('permission denied'));
    render(<ChallengeScreen />);
    expect(await screen.findByText(/permission denied/)).toBeTruthy();
  });
});
