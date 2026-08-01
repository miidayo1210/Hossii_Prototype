import type { ActiveSpaceMembershipStatus } from './membershipJoinController';

/** Participant list SELECT requires active membership (RLS). */
export function canFetchChallengeParticipantList(
  status: ActiveSpaceMembershipStatus,
): boolean {
  return status === 'active';
}

export function isChallengeListAccessDenied(
  status: ActiveSpaceMembershipStatus,
): boolean {
  return status === 'none' || status === 'error';
}

/** idle / joining: membership not settled — do not treat RLS empty as formal empty. */
export function isChallengeListWaitingMembership(
  status: ActiveSpaceMembershipStatus,
): boolean {
  return status === 'idle' || status === 'joining';
}

export const CHALLENGE_LIST_LOAD_TIMEOUT_MS = 12_000;

export class ChallengeListLoadTimeoutError extends Error {
  constructor(message = 'challenge_list_timeout') {
    super(message);
    this.name = 'ChallengeListLoadTimeoutError';
  }
}

/** List-load only. Rejects if `promise` stays pending past `ms`. */
export function withChallengeListTimeout<T>(
  promise: Promise<T>,
  ms: number = CHALLENGE_LIST_LOAD_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ChallengeListLoadTimeoutError());
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
