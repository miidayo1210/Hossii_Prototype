export type ChallengeProgramStatus =
  | 'draft'
  | 'published'
  | 'ended'
  | 'archived';

export type ChallengeItemType = 'question' | 'mission';

export type ChallengeResponseType =
  | 'comment'
  | 'photo'
  | 'single_choice'
  | 'completion';

export const CHALLENGE_PROGRAM_STATUSES = [
  'draft',
  'published',
  'ended',
  'archived',
] as const satisfies readonly ChallengeProgramStatus[];

export const CHALLENGE_ITEM_TYPES = [
  'question',
  'mission',
] as const satisfies readonly ChallengeItemType[];

export const CHALLENGE_RESPONSE_TYPES = [
  'comment',
  'photo',
  'single_choice',
  'completion',
] as const satisfies readonly ChallengeResponseType[];

export const CHALLENGE_TITLE_MAX_LENGTH = 200;

/** App domain type (camelCase). Timestamps follow SpacePane as Date. */
export type ChallengeProgram = {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  status: ChallengeProgramStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChallengeItem = {
  id: string;
  programId: string;
  itemType: ChallengeItemType;
  title: string;
  description: string | null;
  reason: string | null;
  responseType: ChallengeResponseType;
  isRequired: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Create input — status is always draft; id/createdBy/timestamps are DB-owned. */
export type CreateChallengeProgramInput = {
  spaceId: string;
  title: string;
  description?: string | null;
};

export type UpdateChallengeProgramInput = {
  title?: string;
  description?: string | null;
};

export type CreateChallengeItemInput = {
  programId: string;
  itemType?: ChallengeItemType;
  title: string;
  description?: string | null;
  reason?: string | null;
  responseType?: ChallengeResponseType;
  isRequired?: boolean;
  sortOrder?: number;
};

export type UpdateChallengeItemInput = {
  itemType?: ChallengeItemType;
  title?: string;
  description?: string | null;
  reason?: string | null;
  responseType?: ChallengeResponseType;
  isRequired?: boolean;
  sortOrder?: number;
};
