import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChallengeListLoadTimeoutError,
  canFetchChallengeParticipantList,
  isChallengeListAccessDenied,
  isChallengeListWaitingMembership,
  withChallengeListTimeout,
} from './challengeListLoadGate';

describe('challengeListLoadGate', () => {
  it('allows fetch only when membership is active', () => {
    expect(canFetchChallengeParticipantList('active')).toBe(true);
    expect(canFetchChallengeParticipantList('idle')).toBe(false);
    expect(canFetchChallengeParticipantList('joining')).toBe(false);
    expect(canFetchChallengeParticipantList('none')).toBe(false);
    expect(canFetchChallengeParticipantList('error')).toBe(false);
  });

  it('classifies access denied and waiting membership', () => {
    expect(isChallengeListAccessDenied('none')).toBe(true);
    expect(isChallengeListAccessDenied('error')).toBe(true);
    expect(isChallengeListAccessDenied('active')).toBe(false);
    expect(isChallengeListWaitingMembership('idle')).toBe(true);
    expect(isChallengeListWaitingMembership('joining')).toBe(true);
    expect(isChallengeListWaitingMembership('active')).toBe(false);
  });
});

describe('withChallengeListTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when the promise settles in time', async () => {
    const result = withChallengeListTimeout(Promise.resolve('ok'), 1000);
    await expect(result).resolves.toBe('ok');
  });

  it('rejects with timeout when the promise stays pending', async () => {
    const pending = new Promise<string>(() => {});
    const result = withChallengeListTimeout(pending, 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(
      ChallengeListLoadTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
