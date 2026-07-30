// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const listPublishedChallengeProgramsMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/challengeResponsesApi', () => ({
  listPublishedChallengePrograms: (...args: unknown[]) =>
    listPublishedChallengeProgramsMock(...args),
}));

import {
  invalidatePublishedChallengeNavCache,
  useHasPublishedChallengePrograms,
} from './useHasPublishedChallengePrograms';

describe('useHasPublishedChallengePrograms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidatePublishedChallengeNavCache();
  });

  afterEach(() => {
    cleanup();
    invalidatePublishedChallengeNavCache();
  });

  it('stays hidden when disabled or spaceId missing', async () => {
    const { result } = renderHook(() =>
      useHasPublishedChallengePrograms(null, false),
    );
    expect(result.current).toBe(false);
    expect(listPublishedChallengeProgramsMock).not.toHaveBeenCalled();
  });

  it('stays hidden while loading and when zero published programs', async () => {
    let resolveList: (value: unknown[]) => void = () => {};
    listPublishedChallengeProgramsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useHasPublishedChallengePrograms('space-1', true),
    );
    expect(result.current).toBe(false);

    resolveList([]);
    await waitFor(() => {
      expect(listPublishedChallengeProgramsMock).toHaveBeenCalledWith('space-1');
    });
    expect(result.current).toBe(false);
  });

  it('becomes visible only after published programs are confirmed', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([{ id: 'p1' }]);
    const { result } = renderHook(() =>
      useHasPublishedChallengePrograms('space-1', true),
    );
    expect(result.current).toBe(false);
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('stays hidden on API/RLS errors', async () => {
    listPublishedChallengeProgramsMock.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() =>
      useHasPublishedChallengePrograms('space-1', true),
    );
    await waitFor(() => {
      expect(listPublishedChallengeProgramsMock).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('reuses cache and does not refetch within TTL', async () => {
    listPublishedChallengeProgramsMock.mockResolvedValue([{ id: 'p1' }]);
    const first = renderHook(() =>
      useHasPublishedChallengePrograms('space-1', true),
    );
    await waitFor(() => {
      expect(first.result.current).toBe(true);
    });
    expect(listPublishedChallengeProgramsMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() =>
      useHasPublishedChallengePrograms('space-1', true),
    );
    await waitFor(() => {
      expect(second.result.current).toBe(true);
    });
    expect(listPublishedChallengeProgramsMock).toHaveBeenCalledTimes(1);
  });
});
