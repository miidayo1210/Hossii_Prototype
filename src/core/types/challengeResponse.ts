export type ChallengeResponseVisibility = 'self_only' | 'manager_only';

export const CHALLENGE_RESPONSE_VISIBILITIES = [
  'self_only',
  'manager_only',
] as const satisfies readonly ChallengeResponseVisibility[];

export const CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH = 500;

/** App domain type (camelCase). Timestamps follow SpacePane as Date. */
export type ChallengeResponse = {
  id: string;
  itemId: string;
  userId: string;
  visibility: ChallengeResponseVisibility;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Create input — userId is DB/auth owned; never client-set. */
export type CreateChallengeResponseInput = {
  itemId: string;
  comment: string;
  visibility?: ChallengeResponseVisibility;
};

export type UpdateChallengeResponseInput = {
  comment?: string;
  visibility?: ChallengeResponseVisibility;
};
