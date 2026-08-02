import type { ChallengeResponseVisibility } from './challengeResponse';

export type ChallengeProgramStatus =
  | 'draft'
  | 'published'
  | 'ended'
  | 'archived';

export type ChallengeItemType = 'question' | 'mission';

export type ChallengeResponseType =
  | 'comment'
  | 'complete_button'
  | 'choice3'
  | 'photo';

/** Type-specific item settings (choice3 options, optional button copy, etc.). */
export type ChallengeResponseConfig = Record<string, unknown>;

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
  'complete_button',
  'choice3',
  'photo',
] as const satisfies readonly ChallengeResponseType[];

/** Admin UI may create/edit these today. */
export const CHALLENGE_ADMIN_SELECTABLE_RESPONSE_TYPES = [
  'comment',
  'complete_button',
  'choice3',
  'photo',
] as const satisfies readonly ChallengeResponseType[];

export const CHALLENGE_TITLE_MAX_LENGTH = 200;

/** App domain type (camelCase). Timestamps follow SpacePane as Date. */
export type ChallengeProgram = {
  id: string;
  spaceId: string;
  title: string;
  description: string | null;
  status: ChallengeProgramStatus;
  /** Program-wide default for new response stamps. */
  defaultResponseVisibility: ChallengeResponseVisibility;
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
  /** Item override; null inherits program.defaultResponseVisibility. */
  responseVisibility: ChallengeResponseVisibility | null;
  /** Type-specific settings; null when unused. */
  responseConfig: ChallengeResponseConfig | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Create input — status is always draft; id/createdBy/timestamps are DB-owned. */
export type CreateChallengeProgramInput = {
  spaceId: string;
  title: string;
  description?: string | null;
  defaultResponseVisibility?: ChallengeResponseVisibility;
};

export type UpdateChallengeProgramInput = {
  title?: string;
  description?: string | null;
  defaultResponseVisibility?: ChallengeResponseVisibility;
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
  responseVisibility?: ChallengeResponseVisibility | null;
  responseConfig?: ChallengeResponseConfig | null;
};

export type UpdateChallengeItemInput = {
  itemType?: ChallengeItemType;
  title?: string;
  description?: string | null;
  reason?: string | null;
  responseType?: ChallengeResponseType;
  isRequired?: boolean;
  sortOrder?: number;
  responseVisibility?: ChallengeResponseVisibility | null;
  responseConfig?: ChallengeResponseConfig | null;
};
