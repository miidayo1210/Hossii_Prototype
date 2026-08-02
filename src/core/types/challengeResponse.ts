export type ChallengeResponseVisibility =
  | 'space_members'
  | 'manager_only'
  | 'self_only';

export const CHALLENGE_RESPONSE_VISIBILITIES = [
  'space_members',
  'manager_only',
  'self_only',
] as const satisfies readonly ChallengeResponseVisibility[];

export const CHALLENGE_RESPONSE_VISIBILITY_DEFAULT: ChallengeResponseVisibility =
  'manager_only';

export const CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH = 500;

/** App domain type (camelCase). Timestamps follow SpacePane as Date. */
export type ChallengeResponse = {
  id: string;
  itemId: string;
  userId: string;
  visibility: ChallengeResponseVisibility;
  comment: string;
  /** Storage path in challenge-photos; null/undefined for non-photo responses. */
  photoPath?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Create input — userId is DB/auth owned; never client-set.
 * visibility is optional for older clients; RPC ignores it and stamps from settings.
 */
export type CreateChallengeResponseInput = {
  itemId: string;
  comment: string;
  visibility?: ChallengeResponseVisibility;
};

export type UpdateChallengeResponseInput = {
  comment?: string;
  /** @deprecated RPC freezes stamped visibility on rewrite; prefer comment-only updates. */
  visibility?: ChallengeResponseVisibility;
};
